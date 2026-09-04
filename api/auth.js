const { TOTP, Secret } = require('otpauth');
const { put, list } = require('@vercel/blob');

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getTOTP() {
    const secret = process.env.TOTP_SECRET;
    if (!secret) return null;
    return new TOTP({ issuer: 'Portfolio', label: 'admin', algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });

    try {
        const totp = getTOTP();
        if (!totp) return jsonRes(res, 500, { error: 'TOTP_SECRET not set' });

        let body = req.body || {};
        if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }

        const { code } = body;
        if (!code || typeof code !== 'string') return jsonRes(res, 400, { error: 'Code required' });

        const delta = totp.validate({ token: code, window: 1 });
        if (delta === null) return jsonRes(res, 401, { error: 'Invalid code' });

        const token = Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
        await put('sessions/' + token + '.json', JSON.stringify({ token: token, createdAt: Date.now() }), { access: 'private', addRandomSuffix: false, allowOverwrite: true });

        jsonRes(res, 200, { ok: true, token: token });
    } catch (e) {
        jsonRes(res, 500, { error: String(e && e.message || e) });
    }
};
