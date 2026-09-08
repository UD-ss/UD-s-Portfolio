const { TOTP, Secret } = require('otpauth');
const { put, del, list } = require('@vercel/blob');
const crypto = require('crypto');

const SESSION_TTL = 24 * 60 * 60 * 1000;

const RATE_LIMIT = {};
const RATE_WINDOW = 5 * 60 * 1000;
const RATE_MAX = 5;

let lastCleanup = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000;

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://portfolio.ud-ss.me');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getTOTP() {
    const secret = process.env.TOTP_SECRET;
    if (!secret) return null;
    return new TOTP({ issuer: 'Portfolio', label: 'admin', algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
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
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        lastCleanup = now;
        Object.keys(RATE_LIMIT).forEach(function(key) {
            RATE_LIMIT[key] = RATE_LIMIT[key].filter(function(t) { return now - t < RATE_WINDOW; });
            if (RATE_LIMIT[key].length === 0) delete RATE_LIMIT[key];
        });
    }
    if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
    RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(function(t) { return now - t < RATE_WINDOW; });
    if (RATE_LIMIT[ip].length >= RATE_MAX) return false;
    RATE_LIMIT[ip].push(now);
    return true;
}

async function cleanupExpiredSessions() {
    try {
        const result = await list({ prefix: 'sessions/' });
        const now = Date.now();
        const candidates = (result.blobs || []).filter(function(blob) { return /^sessions\/[a-f0-9]{64}\.json$/.test(blob.pathname); }).slice(0, 100);
        await Promise.all(candidates.map(async function(blob) {
            try {
                const r = await fetch(blob.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
                if (!r.ok) return;
                const data = await r.json();
                if (!data || typeof data.createdAt !== 'number' || typeof data.expiresAt !== 'number' || now >= data.expiresAt || now - data.createdAt > SESSION_TTL) await del(blob.pathname);
            } catch (e) {}
        }));
    } catch (e) {}
}

function getBearerToken(req) {
    const auth = req.headers.authorization || '';
    return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method === 'GET') return jsonRes(res, 200, { configured: !!process.env.TOTP_SECRET });

    if (req.method === 'DELETE') {
        const token = getBearerToken(req);
        if (!/^[a-f0-9]{64}$/.test(token)) return jsonRes(res, 401, { error: 'Unauthorized' });
        try {
            await del('sessions/' + token + '.json');
            res.status(204).end();
        } catch (e) {
            jsonRes(res, 500, { error: 'Logout failed' });
        }
        return;
    }

    if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });

    try {
        const ip = getIP(req);
        if (!checkRate(ip)) return jsonRes(res, 429, { error: 'Too many attempts. Try again later.' });

        const totp = getTOTP();
        if (!totp) return jsonRes(res, 500, { error: 'TOTP_SECRET not set' });

        let body = req.body || {};
        if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }

        const rawCode = body && body.code;
        if (!rawCode || typeof rawCode !== 'string') return jsonRes(res, 400, { error: 'Code required' });
        const code = rawCode.trim();
        if (!/^\d{6}$/.test(code)) return jsonRes(res, 400, { error: 'Valid 6-digit code required' });

        const delta = totp.validate({ token: code, window: 1 });
        if (delta === null) return jsonRes(res, 401, { error: 'Invalid code' });

        const token = crypto.randomBytes(32).toString('hex');
        await put('sessions/' + token + '.json', JSON.stringify({ token: token, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL }), { access: 'private', addRandomSuffix: false, allowOverwrite: true });
        cleanupExpiredSessions();

        jsonRes(res, 200, { ok: true, token: token, expiresIn: SESSION_TTL });
    } catch (e) {
        jsonRes(res, 500, { error: 'Server error' });
    }
};
