const { list, put, del } = require('@vercel/blob');

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://portfolio.ud-ss.me');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const SESSION_TTL = 24 * 60 * 60 * 1000;
const MAX_PROJECTS_PER_GROUP = 50;
const MAX_PAYLOAD_SIZE = 1024 * 1024;
const MAX_BACKUPS = 10;
const DANGEROUS_SCHEMES = /^(javascript|data|vbscript):/i;

function compareBackups(a, b) {
    const aMatch = a.pathname.match(/^projects\/backups\/(\d+)-(\d+)\.json$/);
    const bMatch = b.pathname.match(/^projects\/backups\/(\d+)-(\d+)\.json$/);
    const byCreatedAt = Number(bMatch[2]) - Number(aMatch[2]);
    return byCreatedAt || Number(bMatch[1]) - Number(aMatch[1]);
}

function sanitizeStr(s, maxLen) {
    if (typeof s !== 'string') return '';
    s = s.replace(/<[^>]*>/g, '').trim();
    return s.slice(0, maxLen || 500);
}

function sanitizeLink(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url || DANGEROUS_SCHEMES.test(url)) return '';
    if (/^\/\//.test(url)) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) return '';
    return url.slice(0, 2000);
}

function isManagedBlobUrl(url) {
    return typeof url === 'string' && /^https?:\/\/[^/]*(?:blob\.vercel-storage\.com|blob\.vercel-cdn\.com)\//i.test(url);
}

function collectImages(data) {
    const images = [];
    (data && data.highlighted || []).forEach(function(p) {
        if (p && isManagedBlobUrl(p.image)) images.push(p.image);
    });
    return images;
}

function validateProjects(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    if (!Array.isArray(body.highlighted) || !Array.isArray(body.more)) return null;
    if (body.highlighted.length > MAX_PROJECTS_PER_GROUP || body.more.length > MAX_PROJECTS_PER_GROUP) return null;

    const ids = new Set();
    function validateId(id) {
        if (!id || ids.has(id)) return false;
        ids.add(id);
        return true;
    }

    const highlighted = body.highlighted.map(function(p) {
        if (!p || typeof p !== 'object') return null;
        const item = {
            id: sanitizeStr(p.id, 100),
            title: sanitizeStr(p.title, 200),
            description: sanitizeStr(p.description, 1000),
            tags: Array.isArray(p.tags) ? p.tags.slice(0, 10).map(function(t) { return sanitizeStr(t, 50); }) : [],
            image: sanitizeLink(p.image),
            link: sanitizeLink(p.link),
            placeholder: !!p.placeholder
        };
        return validateId(item.id) ? item : null;
    }).filter(Boolean);

    if (highlighted.length !== body.highlighted.length) return null;

    const more = body.more.map(function(p) {
        if (!p || typeof p !== 'object') return null;
        const item = {
            id: sanitizeStr(p.id, 100),
            title: sanitizeStr(p.title, 200),
            description: sanitizeStr(p.description, 1000),
            tech: sanitizeStr(p.tech, 200),
            link: sanitizeLink(p.link)
        };
        return validateId(item.id) ? item : null;
    }).filter(Boolean);

    if (more.length !== body.more.length) return null;
    const result = { highlighted: highlighted, more: more };
    if (body.version !== undefined) {
        if (!Number.isInteger(body.version) || body.version < 0) return null;
        result.version = body.version;
    }
    return result;
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

async function readProjects() {
    try {
        const { blobs } = await list({ prefix: 'projects.json' });
        const file = blobs.find(function(b) { return b.pathname === 'projects.json'; });
        if (!file) return null;
        const r = await fetch(file.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
        if (!r.ok) return null;
        return await r.json();
    } catch (e) {
        return null;
    }
}

function getVersion(data) {
    return data && Number.isInteger(data.version) && data.version >= 0 ? data.version : 0;
}

async function createBackup(data, version) {
    if (!data) return;
    const pathname = 'projects/backups/' + version + '-' + Date.now() + '.json';
    await put(pathname, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: false });
}

async function pruneBackups() {
    const result = await list({ prefix: 'projects/backups/' });
    const backups = (result.blobs || []).filter(function(blob) { return /^projects\/backups\/\d+-\d+\.json$/.test(blob.pathname); }).sort(compareBackups);
    await Promise.all(backups.slice(MAX_BACKUPS).map(function(blob) { return del(blob.pathname); }));
}

async function collectBackupImages() {
    const protectedImages = new Set();
    try {
        const result = await list({ prefix: 'projects/backups/' });
        const backups = (result.blobs || []).filter(function(blob) { return /^projects\/backups\/\d+-\d+\.json$/.test(blob.pathname); }).sort(compareBackups).slice(0, MAX_BACKUPS);
        await Promise.all(backups.map(async function(blob) {
            try {
                const r = await fetch(blob.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
                if (r.ok) collectImages(await r.json()).forEach(function(url) { protectedImages.add(url); });
            } catch (e) {}
        }));
    } catch (e) {}
    return protectedImages;
}

async function cleanupRemovedImages(previous, next) {
    const currentImages = new Set(collectImages(next));
    const backupImages = await collectBackupImages();
    const removed = new Set(collectImages(previous));
    await Promise.all(Array.from(removed).filter(function(url) { return !currentImages.has(url) && !backupImages.has(url); }).map(function(url) { return del(url); }));
}

async function readBackup(pathname) {
    if (typeof pathname !== 'string' || !/^projects\/backups\/\d+-\d+\.json$/.test(pathname)) return null;
    try {
        const result = await list({ prefix: pathname });
        const blob = (result.blobs || []).find(function(item) { return item.pathname === pathname; });
        if (!blob) return null;
        const r = await fetch(blob.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
        return r.ok ? await r.json() : null;
    } catch (e) {
        return null;
    }
}

async function listBackups() {
    const result = await list({ prefix: 'projects/backups/' });
    return (result.blobs || []).filter(function(blob) { return /^projects\/backups\/\d+-\d+\.json$/.test(blob.pathname); }).sort(compareBackups).slice(0, MAX_BACKUPS).map(function(blob) {
        const match = blob.pathname.match(/^projects\/backups\/(\d+)-(\d+)\.json$/);
        return { name: blob.pathname, version: Number(match[1]), createdAt: Number(match[2]) };
    });
}

function parseRequestBody(req) {
    let body = req.body || {};
    if (typeof body === 'string') {
        if (Buffer.byteLength(body, 'utf8') > MAX_PAYLOAD_SIZE) return null;
        try { body = JSON.parse(body); } catch (e) { return null; }
    } else if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_PAYLOAD_SIZE) {
        return null;
    }
    return body;
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
        ],
        version: 0
    };
}

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        if (req.method === 'GET') {
            const url = new URL(req.url || '/api/projects', 'https://portfolio.ud-ss.me');
            if (url.searchParams.get('backups') === '1') {
                const auth = req.headers.authorization || '';
                const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
                if (!await readSession(token)) return jsonRes(res, 401, { error: 'Unauthorized' });
                return jsonRes(res, 200, { backups: await listBackups() });
            }
            const data = await readProjects();
            return jsonRes(res, 200, data || readDefaultProjects());
        }

        if (req.method === 'POST') {
            const auth = req.headers.authorization || '';
            const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
            const session = await readSession(token);
            if (!session) return jsonRes(res, 401, { error: 'Unauthorized' });

            let body = parseRequestBody(req);
            if (!body) return jsonRes(res, 400, { error: 'Invalid or oversized JSON body' });

            const current = await readProjects();
            const currentVersion = getVersion(current);
            const requestedVersion = Number.isInteger(body.version) ? body.version : null;
            if (current && requestedVersion === null) return jsonRes(res, 409, { error: 'Project version required. Reload before saving.', version: currentVersion });
            if (requestedVersion !== null && requestedVersion !== currentVersion) return jsonRes(res, 409, { error: 'Project data changed. Reload before saving.', version: currentVersion });

            if (body.action === 'restore') {
                const backup = await readBackup(body.backup);
                if (!backup) return jsonRes(res, 404, { error: 'Backup not found' });
                body = backup;
                body.version = currentVersion;
            }

            if (!body.highlighted || !Array.isArray(body.highlighted)) return jsonRes(res, 400, { error: 'highlighted array required' });
            if (!body.more || !Array.isArray(body.more)) return jsonRes(res, 400, { error: 'more array required' });

            const validated = validateProjects(body);
            if (!validated) return jsonRes(res, 400, { error: 'Invalid project data, duplicate IDs, or project limit exceeded' });

            if (current) await createBackup(current, currentVersion);
            validated.version = currentVersion + 1;
            validated.updatedAt = Date.now();
            await writeProjects(validated);
            await pruneBackups();
            if (current) await cleanupRemovedImages(current, validated);
            return jsonRes(res, 200, { ok: true, version: validated.version, updatedAt: validated.updatedAt });
        }

        jsonRes(res, 405, { error: 'Method not allowed' });
    } catch (e) {
        jsonRes(res, 500, { error: 'Server error' });
    }
};
