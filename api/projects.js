const { list, put } = require('@vercel/blob');

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://portfolio.ud-ss.me');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const SESSION_TTL = 24 * 60 * 60 * 1000;
const DANGEROUS_SCHEMES = /^(javascript|data|vbscript):/i;

function sanitizeStr(s, maxLen) {
    if (typeof s !== 'string') return '';
    s = s.replace(/<[^>]*>/g, '').trim();
    return s.slice(0, maxLen || 500);
}

function sanitizeLink(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    if (DANGEROUS_SCHEMES.test(url)) return '';
    return url.slice(0, 2000);
}

function validateProjects(body) {
    if (!body || typeof body !== 'object') return null;
    if (!Array.isArray(body.highlighted) || !Array.isArray(body.more)) return null;

    body.highlighted = body.highlighted.map(function(p) {
        if (!p || typeof p !== 'object') return null;
        return {
            id: sanitizeStr(p.id, 100),
            title: sanitizeStr(p.title, 200),
            description: sanitizeStr(p.description, 1000),
            tags: Array.isArray(p.tags) ? p.tags.slice(0, 10).map(function(t) { return sanitizeStr(t, 50); }) : [],
            image: sanitizeLink(p.image),
            link: sanitizeLink(p.link),
            placeholder: !!p.placeholder
        };
    }).filter(Boolean);

    body.more = body.more.map(function(p) {
        if (!p || typeof p !== 'object') return null;
        return {
            id: sanitizeStr(p.id, 100),
            title: sanitizeStr(p.title, 200),
            description: sanitizeStr(p.description, 1000),
            tech: sanitizeStr(p.tech, 200),
            link: sanitizeLink(p.link)
        };
    }).filter(Boolean);

    return body;
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

async function readProjects() {
    try {
        const { blobs } = await list({ prefix: 'projects.json' });
        if (!blobs.length) return null;
        const r = await fetch(blobs[0].url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
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

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        if (req.method === 'GET') {
            const data = await readProjects();
            return jsonRes(res, 200, data || readDefaultProjects());
        }

        if (req.method === 'POST') {
            const auth = req.headers.authorization || '';
            const token = auth.replace('Bearer ', '');
            const session = await readSession(token);
            if (!session) return jsonRes(res, 401, { error: 'Unauthorized' });

            let body = req.body || {};
            if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }

            if (!body.highlighted || !Array.isArray(body.highlighted)) return jsonRes(res, 400, { error: 'highlighted array required' });
            if (!body.more || !Array.isArray(body.more)) return jsonRes(res, 400, { error: 'more array required' });

            const validated = validateProjects(body);
            if (!validated) return jsonRes(res, 400, { error: 'Invalid project data' });

            await writeProjects(validated);
            return jsonRes(res, 200, { ok: true });
        }

        jsonRes(res, 405, { error: 'Method not allowed' });
    } catch (e) {
        jsonRes(res, 500, { error: String(e && e.message || e) });
    }
};
