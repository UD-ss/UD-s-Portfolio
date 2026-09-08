const RATE_LIMIT = {};
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = 30;
const MAX_BODY_FIELDS = 20;
const MAX_STRING_LENGTH = 1000;

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }

    const ip = getIP(req);
    if (!checkRate(ip)) {
        res.status(429).json({ ok: false, error: 'Too many requests' });
        return;
    }

    const webhook = process.env.SHEETS_WEBHOOK_URL;
    if (!webhook) {
        res.status(500).json({ ok: false, error: 'SHEETS_WEBHOOK_URL not set' });
        return;
    }

    let body = req.body || {};
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = {};
        }
    }
    if (typeof body !== 'object' || Array.isArray(body)) body = {};

    const allowedKeys = ['type', 'data', 'page', 'ts'];
    const clean = {};
    allowedKeys.forEach(function(key) {
        if (body[key] === undefined) return;
        if (typeof body[key] === 'string') {
            clean[key] = body[key].slice(0, MAX_STRING_LENGTH);
        } else if (typeof body[key] === 'number' || typeof body[key] === 'boolean') {
            clean[key] = body[key];
        } else if (typeof body[key] === 'object' && body[key] !== null) {
            try { clean[key] = JSON.parse(JSON.stringify(body[key])); } catch (_) { clean[key] = {}; }
        }
    });

    clean.ip = ip;
    clean.userAgent = (req.headers['user-agent'] || '').slice(0, 500);
    clean.receivedAt = new Date().toISOString();

    try {
        const r = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clean),
        });
        if (!r.ok) throw new Error('sheets responded ' + r.status);
        res.status(200).json({ ok: true });
    } catch (e) {
        res.status(502).json({ ok: false, error: 'Logging failed' });
    }
};