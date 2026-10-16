const { list, put } = require('@vercel/blob');
const crypto = require('crypto');

const COUNTER_FILE = 'counter.json';
const RATELIMIT_FILE = 'ratelimit.json';

const MEM_WINDOW = 60 * 1000;
const MEM_MAX_PER_IP = 5;
const DAILY_MAX_PER_IP = 20;
const IP_SALT = 'ud-portfolio-counter-v1';

const MEM = {};
let queue = Promise.resolve();

function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.catch(function() {});
    return run;
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function getIP(req) {
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp) return realIp;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        const parts = forwarded.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        if (parts.length) return parts[parts.length - 1];
    }
    return (req.connection && req.connection.remoteAddress) || 'unknown';
}

function ipKey(ip) {
    return crypto.createHash('sha256').update(IP_SALT + '|' + ip).digest('hex').slice(0, 32);
}

function allowByMemory(key) {
    const now = Date.now();
    if (!MEM[key]) MEM[key] = [];
    MEM[key] = MEM[key].filter(function(t) { return now - t < MEM_WINDOW; });
    if (MEM[key].length >= MEM_MAX_PER_IP) return false;
    MEM[key].push(now);
    return true;
}

async function readBlob(pathname, fallback) {
    try {
        const { blobs } = await list({ prefix: pathname });
        const file = blobs.find(function(b) { return b.pathname === pathname; });
        if (!file) return fallback;
        const r = await fetch(file.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
        if (!r.ok) return fallback;
        return await r.json();
    } catch (e) {
        return fallback;
    }
}

async function writeBlob(pathname, data) {
    await put(pathname, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true });
}

async function readCounter() {
    const data = await readBlob(COUNTER_FILE, null);
    if (!data || typeof data.total !== 'number') return { total: 0, today: 0, date: todayKey() };
    if (data.date !== todayKey()) return { total: data.total, today: 0, date: todayKey() };
    return { total: data.total, today: data.today || 0, date: data.date };
}

async function readRatelimit() {
    const data = await readBlob(RATELIMIT_FILE, null);
    if (!data || data.date !== todayKey() || typeof data.ips !== 'object' || data.ips === null) return { date: todayKey(), ips: {} };
    return data;
}

function counters(res, counted) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Counted', counted ? '1' : '0');
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    if (req.method === 'GET') {
        const data = await readCounter();
        counters(res, false);
        res.status(200).json({ total: data.total, today: data.today });
        return;
    }

    if (req.method === 'POST') {
        const key = ipKey(getIP(req));
        if (!allowByMemory(key)) {
            res.setHeader('Retry-After', '60');
            res.status(429).json({ error: 'Too many requests' });
            return;
        }

        return enqueue(async function() {
            const MAX_RETRIES = 5;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    const [counter, rl] = await Promise.all([readCounter(), readRatelimit()]);
                    const used = rl.ips[key] || 0;

                    if (used >= DAILY_MAX_PER_IP) {
                        counters(res, false);
                        res.status(200).json({ total: counter.total, today: counter.today });
                        return;
                    }

                    rl.ips[key] = used + 1;
                    counter.total += 1;
                    counter.today += 1;

                    await writeBlob(COUNTER_FILE, counter);
                    await writeBlob(RATELIMIT_FILE, rl);

                    counters(res, true);
                    res.status(200).json({ total: counter.total, today: counter.today });
                    return;
                } catch (e) {
                    if (attempt === MAX_RETRIES - 1) {
                        res.status(500).json({ error: 'Server error' });
                        return;
                    }
                    await new Promise(function(r) { setTimeout(r, 100 * (attempt + 1) + Math.random() * 50); });
                }
            }
        });
    }

    res.status(405).json({ error: 'Method not allowed' });
};
