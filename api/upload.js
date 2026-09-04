const { list, put } = require('@vercel/blob');

const SESSION_TTL = 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readSession(token) {
    if (!token) return null;
    try {
        const { blobs } = await list({ prefix: 'sessions/' });
        const sessionBlob = blobs.find(function(b) { return b.url.indexOf(token) !== -1; });
        if (!sessionBlob) return null;
        const r = await fetch(sessionBlob.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
        const data = await r.json();
        if (Date.now() - data.createdAt > SESSION_TTL) return null;
        return data;
    } catch (e) {
        return null;
    }
}

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });

    try {
        const auth = req.headers.authorization || '';
        const token = auth.replace('Bearer ', '');
        const session = await readSession(token);
        if (!session) return jsonRes(res, 401, { error: 'Unauthorized' });

        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) return jsonRes(res, 400, { error: 'multipart/form-data required' });

        let buffer;
        try {
            const chunks = [];
            await new Promise(function(resolve, reject) {
                req.on('data', function(chunk) { chunks.push(chunk); });
                req.on('end', resolve);
                req.on('error', reject);
            });
            buffer = Buffer.concat(chunks);
        } catch (e) {
            return jsonRes(res, 400, { error: 'Failed to read body' });
        }

        const boundary = contentType.split('boundary=')[1];
        if (!boundary) return jsonRes(res, 400, { error: 'No boundary' });

        const parts = buffer.toString('binary').split('--' + boundary);
        for (const part of parts) {
            const filenameMatch = part.match(/filename="(.+?)"/);
            if (!filenameMatch) continue;
            const filename = filenameMatch[1];
            const ext = filename.split('.').pop().toLowerCase();
            if (ALLOWED_EXT.indexOf(ext) === -1) return jsonRes(res, 400, { error: 'Invalid extension: ' + ext });

            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd === -1) continue;
            const fileData = part.slice(headerEnd + 4);
            const cleanData = fileData.replace(/\r\n$/, '');

            if (Buffer.byteLength(cleanData, 'binary') > MAX_FILE_SIZE) return jsonRes(res, 400, { error: 'File too large (max 5MB)' });

            const safeName = 'projects/' + Date.now() + '-' + filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            await put(safeName, Buffer.from(cleanData, 'binary'), { access: 'public', addRandomSuffix: false, allowOverwrite: true });

            const { blobs } = await list({ prefix: safeName });
            const url = blobs.length ? blobs[0].url : '';
            return jsonRes(res, 200, { ok: true, url: url });
        }

        return jsonRes(res, 400, { error: 'No file found' });
    } catch (e) {
        jsonRes(res, 500, { error: String(e && e.message || e) });
    }
};
