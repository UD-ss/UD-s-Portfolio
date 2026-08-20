module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
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

    body.ip = String(req.headers['x-forwarded-for'] || req.connection.remoteAddress || '');
    body.userAgent = req.headers['user-agent'] || '';
    body.receivedAt = new Date().toISOString();

    try {
        const r = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('sheets responded ' + r.status);
        res.status(200).json({ ok: true });
    } catch (e) {
        res.status(502).json({ ok: false, error: String((e && e.message) || e) });
    }
};