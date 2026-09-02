const { list, put } = require('@vercel/blob');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
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
            if (!blobs.length) {
                res.status(200).json({ total: 0, today: 0 });
                return;
            }
            const r = await fetch(blobs[0].url, {
                headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
            });
            const data = await r.json();
            const todayKey = new Date().toISOString().slice(0, 10);
            if (data.date !== todayKey) data.today = 0;
            res.status(200).json({ total: data.total || 0, today: data.today || 0 });
        } catch (e) {
            res.status(200).json({ total: 0, today: 0 });
        }
        return;
    }

    if (req.method === 'POST') {
        try {
            const { blobs } = await list({ prefix: FILE });
            let data = { total: 0, today: 0, date: '' };
            if (blobs.length) {
                const r = await fetch(blobs[0].url, {
                    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
                });
                data = await r.json();
            }
            const todayKey = new Date().toISOString().slice(0, 10);
            if (data.date !== todayKey) {
                data.today = 0;
                data.date = todayKey;
            }
            data.total = (data.total || 0) + 1;
            data.today = (data.today || 0) + 1;
            await put(FILE, JSON.stringify(data), { access: 'private', addRandomSuffix: false });
            res.status(200).json({ total: data.total, today: data.today });
        } catch (e) {
            res.status(500).json({ error: String(e && e.message || e) });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
};
