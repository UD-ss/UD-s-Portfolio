const { list, put } = require('@vercel/blob');

const RATE_LIMIT = {};
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = 10;
let updateTail = Promise.resolve();

function enqueueUpdate(task) {
    const run = updateTail.then(task, task);
    updateTail = run.catch(function() {});
    return run;
}

function getIP(req) {
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        const first = forwarded.split(',')[0].trim();
        if (first) return first;
    }
    return (req.connection && req.connection.remoteAddress) || 'unknown';
}

function checkRate(ip) {
    const now = Date.now();
    if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
    RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(function(t) { return now - t < RATE_WINDOW; });
    if (RATE_LIMIT[ip].length >= RATE_MAX) return false;
    RATE_LIMIT[ip].push(now);
    return true;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://portfolio.ud-ss.me');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const FILE = 'counter.json';

    if (req.method === 'GET') {
        try {
            const { blobs } = await list({ prefix: FILE });
            const file = blobs.find(function(b) { return b.pathname === FILE; });
            if (!file) {
                res.status(200).json({ total: 0, today: 0 });
                return;
            }
            const r = await fetch(file.url, {
                headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
            });
            if (!r.ok) {
                res.status(200).json({ total: 0, today: 0 });
                return;
            }
            let data;
            try { data = await r.json(); } catch (_) { data = null; }
            if (!data || typeof data.total === 'undefined') {
                res.status(200).json({ total: 0, today: 0 });
                return;
            }
            const todayKey = new Date().toISOString().slice(0, 10);
            if (data.date !== todayKey) data.today = 0;
            res.status(200).json({ total: data.total || 0, today: data.today || 0 });
        } catch (e) {
            res.status(200).json({ total: 0, today: 0 });
        }
        return;
    }

    if (req.method === 'POST') {
        const ip = getIP(req);
        if (!checkRate(ip)) {
            res.status(429).json({ error: 'Too many requests' });
            return;
        }

        return enqueueUpdate(async function() {
            const MAX_RETRIES = 10;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    const { blobs } = await list({ prefix: FILE });
                    const file = blobs.find(function(b) { return b.pathname === FILE; });
                    let data = { total: 0, today: 0, date: '' };
                    if (file) {
                        const r = await fetch(file.url, {
                            headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
                        });
                        if (r.ok) {
                            try { data = await r.json(); } catch (_) { data = { total: 0, today: 0, date: '' }; }
                        }
                    }
                    const todayKey = new Date().toISOString().slice(0, 10);
                    if (data.date !== todayKey) {
                        data.today = 0;
                        data.date = todayKey;
                    }
                    data.total = (data.total || 0) + 1;
                    data.today = (data.today || 0) + 1;
                    await put(FILE, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true });
                    res.status(200).json({ total: data.total, today: data.today });
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
