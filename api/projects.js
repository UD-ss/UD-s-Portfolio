const { list, put } = require('@vercel/blob');
const { TOTP, Secret } = require('otpauth');

const SESSION_TTL = 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

function getTOTP() {
    const secret = process.env.TOTP_SECRET;
    if (!secret) return null;
    return new TOTP({ issuer: 'Portfolio', label: 'admin', algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}

function jsonRes(res, status, data) {
    res.status(status).json(data);
}

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readSession(token) {
    if (!token) return null;
    try {
        const { blobs } = await list({ prefix: 'sessions/' });
        const sessionBlob = blobs.find(b => b.url.includes(token));
        if (!sessionBlob) return null;
        const r = await fetch(sessionBlob.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
        const data = await r.json();
        if (Date.now() - data.createdAt > SESSION_TTL) return null;
        return data;
    } catch (e) {
        return null;
    }
}

async function readProjects() {
    try {
        const { blobs } = await list({ prefix: 'projects.json' });
        if (!blobs.length) return null;
        const r = await fetch(blobs[0].url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
        return await r.json();
    } catch (e) {
        return null;
    }
}

async function writeProjects(data) {
    await put('projects.json', JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true });
}

function readDefaultProjects() {
    return {
        highlighted: [
            { id: 'ud-space', title: "UD's Space", description: 'Node.js 기반 봇 클러스터 및 Supabase 연동 커뮤니티', tags: ['Node.js', 'Discord.js', 'Supabase'], image: 'ud-space.png', link: '' },
            { id: 'manga-translate', title: 'Manga-Translate', description: 'YOLOv8, Manga-OCR, LaMa Inpainting, 로컬 LLM 및 React Konva를 결합하여 이미지 내 텍스트를 실시간 감지·제거·번역·편집할 수 있는 풀스택 플랫폼.', tags: ['React 19', 'FastAPI', 'YOLOv8', 'PyTorch'], image: 'manga-translate.png', link: '' },
            { id: 'coming-soon', title: '???', description: '곧 공개 예정인 프로젝트입니다.', tags: ['TBA'], image: '', link: '', placeholder: true }
        ],
        more: [
            { id: 'auto-illust-sorter', title: 'Automatic Illustration Sorter', description: 'ONNX 듀얼 AI 캐스케이드 및 pHash 초고속 이미지 정렬', tech: 'Python · ONNX', link: '' },
            { id: 'autoillust', title: 'AutoIllust', description: '로컬 LLM 자연어 쿼리 기반 멀티 플랫폼 이미지 수집 풀스택', tech: 'Ollama · FastAPI', link: '' },
            { id: 'auto-dl', title: 'Auto-DL', description: 'Chrome MV3 File System Access API 기반 미디어 수집 확장 프로그램', tech: 'JS (MV3)', link: '' },
            { id: 'studio-diffusion', title: 'Studio Diffusion & LoRA Trainer', description: 'HuggingFace Diffusers SDXL/Pony WebGUI 및 LoRA 학습 파이프라인', tech: 'PyTorch', link: '' }
        ]
    };
}

async function handleGet(req, res) {
    const data = await readProjects();
    jsonRes(res, 200, data || readDefaultProjects());
}

async function handleAuth(req, res) {
    const totp = getTOTP();
    if (!totp) return jsonRes(res, 500, { error: 'TOTP_SECRET not set' });

    let body = req.body || {};
    if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }

    const { code } = body;
    if (!code || typeof code !== 'string') return jsonRes(res, 400, { error: 'Code required' });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) return jsonRes(res, 401, { error: 'Invalid code' });

    const token = Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
    await put(`sessions/${token}.json`, JSON.stringify({ token, createdAt: Date.now() }), { access: 'private', addRandomSuffix: false, allowOverwrite: true });

    jsonRes(res, 200, { ok: true, token });
}

async function handleSave(req, res) {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '');
    const session = await readSession(token);
    if (!session) return jsonRes(res, 401, { error: 'Unauthorized' });

    let body = req.body || {};
    if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }

    if (!body.highlighted || !Array.isArray(body.highlighted)) return jsonRes(res, 400, { error: 'highlighted array required' });
    if (!body.more || !Array.isArray(body.more)) return jsonRes(res, 400, { error: 'more array required' });

    await writeProjects(body);
    jsonRes(res, 200, { ok: true });
}

async function handleUpload(req, res) {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '');
    const session = await readSession(token);
    if (!session) return jsonRes(res, 401, { error: 'Unauthorized' });

    try {
        const chunks = [];
        const reader = req.body.getReader ? req.body.getReader() : null;
        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
        }
    } catch (e) {}

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) return jsonRes(res, 400, { error: 'multipart/form-data required' });

    let buffer;
    try {
        const chunks = [];
        await new Promise((resolve, reject) => {
            req.on('data', chunk => chunks.push(chunk));
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
        if (!ALLOWED_EXT.includes(ext)) return jsonRes(res, 400, { error: `Invalid extension: ${ext}` });

        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const fileData = part.slice(headerEnd + 4);
        const cleanData = fileData.replace(/\r\n$/, '');

        if (Buffer.byteLength(cleanData, 'binary') > MAX_FILE_SIZE) return jsonRes(res, 400, { error: 'File too large (max 5MB)' });

        const safeName = `projects/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await put(safeName, Buffer.from(cleanData, 'binary'), { access: 'public', addRandomSuffix: false, allowOverwrite: true });

        const { blobs } = await list({ prefix: safeName });
        const url = blobs.length ? blobs[0].url : '';
        return jsonRes(res, 200, { ok: true, url });
    }

    return jsonRes(res, 400, { error: 'No file found' });
}

module.exports = async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const url = new URL(req.url, `https://${req.headers.host}`);

    try {
        if (url.pathname === '/api/projects/auth' && req.method === 'POST') return await handleAuth(req, res);
        if (url.pathname === '/api/projects/upload' && req.method === 'POST') return await handleUpload(req, res);
        if (url.pathname === '/api/projects') {
            if (req.method === 'GET') return await handleGet(req, res);
            if (req.method === 'POST') return await handleSave(req, res);
        }

        jsonRes(res, 404, { error: 'Not found' });
    } catch (e) {
        jsonRes(res, 500, { error: String(e && e.message || e) });
    }
};
