const { list, put } = require('@vercel/blob');
const crypto = require('crypto');

const SESSION_TTL = 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

const MAGIC_BYTES = {
    png: [0x89, 0x50, 0x4E, 0x47],
    jpg: [0xFF, 0xD8, 0xFF],
    jpeg: [0xFF, 0xD8, 0xFF],
    gif: [0x47, 0x49, 0x46, 0x38],
    webp: [0x52, 0x49, 0x46, 0x46]
};

function checkMagicBytes(buf) {
    if (buf.length < 4) return null;
    for (const ext of ALLOWED_EXT) {
        const magic = MAGIC_BYTES[ext];
        if (!magic) continue;
        let match = true;
        for (let i = 0; i < magic.length; i++) {
            if (buf[i] !== magic[i]) { match = false; break; }
        }
        if (match) {
            if (ext === 'webp') {
                if (buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
                continue;
            }
            return ext;
        }
    }
    return null;
}

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://portfolio.ud-ss.me');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readSession(token) {
    if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    try {
        const { blobs } = await list({ prefix: 'sessions/' + token + '.json' });
        const sessionBlob = blobs.find(function(b) { return b.pathname === 'sessions/' + token + '.json'; });
        if (!sessionBlob) return null;
        const r = await fetch(sessionBlob.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
        if (!r.ok) return null;
        const data = await r.json();
        if (!data || data.token !== token) return null;
        if (typeof data.createdAt !== 'number' || typeof data.expiresAt !== 'number' || Date.now() >= data.expiresAt || Date.now() - data.createdAt > SESSION_TTL) return null;
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
        const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        const session = await readSession(token);
        if (!session) return jsonRes(res, 401, { error: 'Unauthorized' });

        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) return jsonRes(res, 400, { error: 'multipart/form-data required' });

        const contentLength = Number(req.headers['content-length'] || 0);
        if (contentLength > MAX_BODY_SIZE) return jsonRes(res, 413, { error: 'Request body too large (max 10MB)' });

        let buffer;
        try {
            const chunks = [];
            let totalSize = 0;
            let bodyTooLarge = false;
            await new Promise(function(resolve, reject) {
                req.on('data', function(chunk) {
                    if (bodyTooLarge) return;
                    totalSize += chunk.length;
                    if (totalSize > MAX_BODY_SIZE) {
                        bodyTooLarge = true;
                        reject(new Error('Body too large'));
                        return;
                    }
                    chunks.push(chunk);
                });
                req.on('end', resolve);
                req.on('error', reject);
            });
            buffer = Buffer.concat(chunks);
        } catch (e) {
            return jsonRes(res, 400, { error: e.message === 'Body too large' ? 'Request body too large (max 10MB)' : 'Failed to read body' });
        }

        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : null;
        if (!boundary) return jsonRes(res, 400, { error: 'No boundary' });

        const parts = buffer.toString('binary').split('--' + boundary);
        for (const part of parts) {
            const filenameMatch = part.match(/filename="(.+?)"/);
            if (!filenameMatch) continue;
            const rawFilename = filenameMatch[1];
            const cleanFilename = rawFilename.split(/[\/\\]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
            const ext = cleanFilename.split('.').pop().toLowerCase();
            if (ALLOWED_EXT.indexOf(ext) === -1) return jsonRes(res, 400, { error: 'Invalid extension: ' + ext });

            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd === -1) continue;
            const fileData = part.slice(headerEnd + 4);
            const cleanData = fileData.replace(/\r\n$/, '');

            if (Buffer.byteLength(cleanData, 'binary') > MAX_FILE_SIZE) return jsonRes(res, 400, { error: 'File too large (max 5MB)' });

            const fileBuf = Buffer.from(cleanData, 'binary');
            const detectedType = checkMagicBytes(fileBuf);
            const compatibleType = detectedType === 'jpg' && (ext === 'jpg' || ext === 'jpeg');
            if (!detectedType || (detectedType !== ext && !compatibleType)) return jsonRes(res, 400, { error: 'File content does not match its extension' });

            const safeName = 'projects/' + Date.now() + '-' + crypto.randomBytes(8).toString('hex') + '-' + cleanFilename;
            const contentTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
            const blob = await put(safeName, fileBuf, { access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: contentTypes[ext] });

            return jsonRes(res, 200, { ok: true, url: blob && blob.url ? blob.url : '' });
        }

        return jsonRes(res, 400, { error: 'No file found' });
    } catch (e) {
        jsonRes(res, 500, { error: 'Upload failed' });
    }
};
