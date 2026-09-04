const { TOTP, Secret } = require('otpauth');
const { put } = require('@vercel/blob');
const crypto = require('crypto');

const RATE_LIMIT = {};
const RATE_WINDOW = 5 * 60 * 1000;
const RATE_MAX = 5;

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://portfolio.ud-ss.me');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getTOTP() {
    const secret = process.env.TOTP_SECRET;
    if (!secret) return null;
    return new TOTP({ issuer: 'Portfolio', label: 'admin', algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}

function getIP(req) {
    return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
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
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });

    try {
        const ip = getIP(req);
        if (!checkRate(ip)) return jsonRes(res, 429, { error: 'Too many attempts. Try again later.' });

        const totp = getTOTP();
        if (!totp) return jsonRes(res, 500, { error: 'TOTP_SECRET not set' });

        let body = req.body || {};
        if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }

        const { code } = body;
        if (!code || typeof code !== 'string') return jsonRes(res, 400, { error: 'Code required' });

        const delta = totp.validate({ token: code, window: 0 });
        if (delta === null) return jsonRes(res, 401, { error: 'Invalid code' });

        const token = crypto.randomBytes(32).toString('hex');
        await put('sessions/' + token + '.json', JSON.stringify({ token: token, createdAt: Date.now() }), { access: 'private', addRandomSuffix: false, allowOverwrite: true });

        jsonRes(res, 200, { ok: true, token: token });
    } catch (e) {
        jsonRes(res, 500, { error: 'Server error' });
    }
};
