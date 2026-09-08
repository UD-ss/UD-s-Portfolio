const { list, put, del } = require('@vercel/blob');

function jsonRes(res, status, data) { res.status(status).json(data); }
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://portfolio.ud-ss.me');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const SESSION_TTL = 24 * 60 * 60 * 1000;
const MAX_PAYLOAD_SIZE = 1024 * 1024;
const MAX_BACKUPS = 10;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const URL_REGEX = /^https?:\/\//;

function readDefaultConfig() {
    return {
        version: 0,
        updatedAt: null,
        theme: {
            light: {
                bg: '#ece7dd', fg: '#211d18', muted: '#8a8378',
                cardBg: 'rgba(255, 253, 249, 0.85)', cardBorder: '#ddd6ca', border: '#d8d1c4',
                point: '#0055ff', highlightBg: '#211d18', highlightFg: '#ece7dd',
                highlightCard: '#2c2720', listHoverBg: 'rgba(0, 85, 255, 0.04)',
                preloaderBg: '#ece7dd', preloaderFg: '#211d18',
                glassBg: 'rgba(255, 253, 249, 0.7)', glassBorder: 'rgba(0, 0, 0, 0.08)',
                cursorBlend: 'difference', logoFilterBase: 'grayscale(1) brightness(0.7)', logoOpacityBase: '0.5'
            },
            dark: {
                bg: '#1c1e20', fg: '#e6e3de', muted: '#9b968e',
                cardBg: 'rgba(36, 38, 41, 0.75)', cardBorder: '#2b2d30', border: '#27292b',
                point: '#3b82f6', highlightBg: '#151719', highlightFg: '#e6e3de',
                highlightCard: '#26282b', listHoverBg: 'rgba(59, 130, 246, 0.08)',
                preloaderBg: '#1c1e20', preloaderFg: '#e6e3de',
                glassBg: 'rgba(255, 255, 255, 0.06)', glassBorder: 'rgba(255, 255, 255, 0.09)',
                cursorBlend: 'difference', logoFilterBase: 'grayscale(1) brightness(1.6)', logoOpacityBase: '0.4'
            }
        },
        hero: {
            names: ['UD', 'ユーディー', '유디'],
            subtitle: '느낌 있는 코딩과 높은 품질의 로직을<br/>자연어로 설계하는 개발자',
            nameCyclingInterval: 3500
        },
        about: {
            label: 'About Me',
            html: '많은 바이브 코딩 경험을 통해 여러 언어와 기술을 탐색하며 쌓은 이해도를 바탕으로, <span class="highlight-phrase"><span class="highlight-text">바이브 코딩의 품질을 뛰어넘는</span><span class="highlight-line"></span></span> 결과물을 목표로 하는 개발자 유디(UD) 입니다.'
        },
        skills: {
            label: 'Technologies Explored',
            categories: [
                {
                    title: 'Frontend & Mobile',
                    color: '#3178c6',
                    items: [
                        { icon: 'https://cdn.simpleicons.org/react/61DAFB', label: 'React' },
                        { icon: 'https://cdn.simpleicons.org/javascript/F7DF1E', label: 'Vanilla JavaScript' },
                        { icon: 'https://cdn.simpleicons.org/kotlin/7F52FF', label: 'Kotlin · Jetpack Compose' },
                        { icon: 'https://cdn.simpleicons.org/tailwindcss/06B6D4', label: 'Tailwind CSS · Konva.js' },
                        { icon: 'https://cdn.simpleicons.org/googlechrome/4285F4', label: 'Chrome Extension' }
                    ]
                },
                {
                    title: 'Backend & Architecture',
                    color: '#68a063',
                    items: [
                        { icon: 'https://cdn.simpleicons.org/nodedotjs/5FA04E', label: 'Node.js' },
                        { icon: 'https://cdn.simpleicons.org/python/3776AB', label: 'Python' },
                        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg', label: 'Java' },
                        { icon: 'lucide:webhook', label: 'REST · WebSocket · SSE' },
                        { icon: 'lucide:layers', label: 'Clean Architecture · MVVM' }
                    ]
                },
                {
                    title: 'AI / Vision',
                    color: '#ff6b35',
                    items: [
                        { icon: 'https://cdn.simpleicons.org/pytorch/EE4C2C', label: 'YOLO · LaMa Inpainting' },
                        { icon: 'https://cdn.simpleicons.org/pytorch/EE4C2C', label: 'Stable Diffusion · LoRA' },
                        { icon: 'https://cdn.simpleicons.org/ollama/FFFFFF', label: 'Ollama' },
                        { icon: 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'><defs><linearGradient id=\'gg\' x1=\'3\' y1=\'21\' x2=\'21\' y2=\'3\' gradientUnits=\'userSpaceOnUse\'><stop offset=\'0\' stop-color=\'%234285F4\'/><stop offset=\'.52\' stop-color=\'%239B72CB\'/><stop offset=\'1\' stop-color=\'%23D96570\'/></linearGradient></defs><path fill=\'url(%23gg)\' d=\'M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12\'/></svg>', label: 'Gemini' },
                        { icon: 'https://cdn.simpleicons.org/onnx/005CED', label: 'ONNX' }
                    ]
                },
                {
                    title: 'DB & DevOps',
                    color: '#336791',
                    items: [
                        { icon: 'https://cdn.simpleicons.org/postgresql/4169E1', label: 'PostgreSQL' },
                        { icon: 'https://cdn.simpleicons.org/sqlite/003B57', label: 'SQLite' },
                        { icon: 'https://cdn.simpleicons.org/git/F05032', label: 'Git · PM2 Cluster · Vercel' },
                        { icon: 'https://cdn.simpleicons.org/vitest/6E9F18', label: 'Playwright · Vitest · JUnit' },
                        { icon: 'lucide:shield-check', label: 'TLS Pinning · Biometric Auth' }
                    ]
                }
            ]
        },
        contact: {
            label: 'Get in Touch',
            email: 'dev.udss2650@gmail.com',
            links: [
                { label: 'GitHub', url: 'https://github.com/UD-ss', icon: 'github' },
                { label: 'Discord', url: 'https://discord.com/users/1265859527417266206', icon: 'discord' }
            ]
        },
        footer: {
            copyright: '© 2026 ud_ss. All rights reserved.',
            showVisitorCounter: true
        },
        navigation: {
            logo: 'UD.',
            items: [
                { label: 'About', href: '#about' },
                { label: 'Skills', href: '#skills' },
                { label: 'Projects', href: '#projects' },
                { label: 'Contact', href: '#contact' }
            ]
        },
        fireflies: {
            count: { hero: 6, about: 3, skills: 3, contact: 3 },
            lightColors: ['#d4a574ee', '#e8917aee', '#c9908fdd', '#c4886bcc', '#d4a08aee', '#c9a07add'],
            darkColors: ['#3b82f6bb', '#06b6d4cc', '#818cf8aa', '#a78bfa99', '#22d3eebb', '#60a5faaa']
        },
        cursor: {
            enabled: true,
            dotSize: 8,
            ringSize: 40,
            color: '#ffffff',
            blendMode: 'difference'
        },
        projects: {
            maxPerGroup: 50,
            sortOrder: 'manual'
        },
        seo: {
            title: 'UD | Portfolio',
            description: '느낌 있는 코딩과 높은 품질의 로직을 자연어로 설계하는 개발자',
            ogImage: 'https://portfolio.ud-ss.me/api/og',
            siteUrl: 'https://portfolio.ud-ss.me',
            robots: 'noindex, nofollow'
        }
    };
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

async function readConfig() {
    try {
        const { blobs } = await list({ prefix: 'config.json' });
        const file = blobs.find(function(b) { return b.pathname === 'config.json'; });
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
    const pathname = 'config/backups/' + version + '-' + Date.now() + '.json';
    await put(pathname, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: false });
}

async function pruneBackups() {
    const result = await list({ prefix: 'config/backups/' });
    const backups = (result.blobs || []).filter(function(blob) { return /^config\/backups\/\d+-\d+\.json$/.test(blob.pathname); }).sort(function(a, b) { return b.pathname.localeCompare(a.pathname); });
    await Promise.all(backups.slice(MAX_BACKUPS).map(function(blob) { return del(blob.pathname); }));
}

function sanitizeStr(s, maxLen) {
    if (typeof s !== 'string') return '';
    s = s.replace(/<[^>]*>/g, '').trim();
    return s.slice(0, maxLen || 500);
}

function sanitizeHtml(html) {
    if (typeof html !== 'string') return '';
    var DANGEROUS_TAGS = /<(script|style|iframe|object|embed|applet|form|input|textarea|select|button|base|link|meta|svg|math|video|audio|source|template|slot)[^>]*>[\s\S]*?<\/\1[^>]*>/gi;
    var DANGEROUS_SELF_CLOSE = /<(script|style|iframe|object|embed|applet|form|input|textarea|select|button|base|link|meta|svg|math|video|audio|source|template|slot)[^>]*\/?>/gi;
    html = html.replace(DANGEROUS_TAGS, '');
    html = html.replace(DANGEROUS_SELF_CLOSE, '');
    var ALLOWED_TAGS = /^(span|b|i|em|strong|br|p|a|code|mark|small|sub|sup|u|s|del|ins|abbr|q|cite|dfn|time|data|var|kbd|samp|ruby|rt|rp|wbr)$/i;
    html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gi, function(match, tag) {
        return ALLOWED_TAGS.test(tag) ? match : '';
    });
    html = html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
    html = html.replace(/\s(href|src|action|xlink:href)\s*=\s*["']?\s*(javascript|data|vbscript):[^"'\s>]*/gi, '');
    return html.trim();
}

function validateCssValue(val) {
    if (typeof val !== 'string') return '';
    val = val.trim();
    if (val.length >= 200) return '';
    if (/[;{}]/.test(val)) return '';
    if (/expression\s*\(/i.test(val)) return '';
    if (/url\s*\(/i.test(val)) return '';
    if (/javascript\s*:/i.test(val)) return '';
    if (/import\s/i.test(val)) return '';
    if (/behavior\s*:/i.test(val)) return '';
    if (/-moz-binding\s*:/i.test(val)) return '';
    return val;
}

function sanitizeIcon(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    if (url.length >= 1000) return '';
    if (/^lucide:/i.test(url)) return url.slice(0, 200);
    if (/^https?:\/\//i.test(url)) return url.slice(0, 1000);
    if (/^data:image\//i.test(url)) return url.slice(0, 1000);
    return '';
}

function sanitizeHref(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    if (/^(javascript|data|vbscript):/i.test(url)) return '';
    if (/^\/\//.test(url)) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:/i.test(url) && !/^mailto:/i.test(url)) return '';
    return url.slice(0, 500);
}

function sanitizeEmail(email) {
    if (typeof email !== 'string') return '';
    email = email.replace(/<[^>]*>/g, '').replace(/["'`<>()\[\]{}\\|\s]/g, '').trim();
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email)) return '';
    return email.slice(0, 200);
}

function sanitizeLink(url) {
    if (typeof url !== 'string') return '';
    url = url.trim();
    if (!url || /^(javascript|data|vbscript):/i.test(url)) return '';
    if (/^\/\//.test(url)) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) return '';
    return url.slice(0, 2000);
}

function validateTheme(theme) {
    const def = readDefaultConfig().theme;
    if (!theme || typeof theme !== 'object') return def;
    const result = {};
    ['light', 'dark'].forEach(function(key) {
        const t = theme[key];
        if (!t || typeof t !== 'object') { result[key] = def[key]; return; }
        result[key] = {};
        Object.keys(def[key]).forEach(function(varName) {
            const val = t[varName];
            const safe = validateCssValue(val);
            result[key][varName] = safe || def[key][varName];
        });
    });
    return result;
}

function validateHero(hero) {
    const def = readDefaultConfig().hero;
    if (!hero || typeof hero !== 'object') return def;
    const names = Array.isArray(hero.names) ? hero.names.filter(function(n) { return typeof n === 'string' && n.length < 50; }).slice(0, 10) : def.names;
    const subtitle = typeof hero.subtitle === 'string' ? hero.subtitle.replace(/<[^>]*>/g, '').slice(0, 500) : def.subtitle;
    const interval = Number.isInteger(hero.nameCyclingInterval) && hero.nameCyclingInterval > 500 ? hero.nameCyclingInterval : def.nameCyclingInterval;
    return { names: names.length ? names : def.names, subtitle: subtitle, nameCyclingInterval: interval };
}

function validateAbout(about) {
    const def = readDefaultConfig().about;
    if (!about || typeof about !== 'object') return def;
    const label = typeof about.label === 'string' ? sanitizeStr(about.label, 50) : def.label;
    const html = typeof about.html === 'string' ? sanitizeHtml(about.html).slice(0, 3000) : def.html;
    return { label: label, html: html };
}

function validateSkills(skills) {
    const def = readDefaultConfig().skills;
    if (!skills || typeof skills !== 'object') return def;
    const label = typeof skills.label === 'string' ? sanitizeStr(skills.label, 50) : def.label;
    const categories = Array.isArray(skills.categories) ? skills.categories.map(function(cat) {
        if (!cat || typeof cat !== 'object') return null;
        const title = typeof cat.title === 'string' ? sanitizeStr(cat.title, 100) : '';
        const color = typeof cat.color === 'string' && HEX_COLOR.test(cat.color) ? cat.color : '#666666';
        const items = Array.isArray(cat.items) ? cat.items.map(function(item) {
            if (!item || typeof item !== 'object') return null;
            const icon = sanitizeIcon(item.icon);
            const label = typeof item.label === 'string' ? sanitizeStr(item.label, 100) : '';
            return icon && label ? { icon: icon, label: label } : null;
        }).filter(Boolean).slice(0, 20) : [];
        return title && items.length ? { title: title, color: color, items: items } : null;
    }).filter(Boolean).slice(0, 10) : def.categories;
    return { label: label, categories: categories.length ? categories : def.categories };
}

function validateContact(contact) {
    const def = readDefaultConfig().contact;
    if (!contact || typeof contact !== 'object') return def;
    const label = typeof contact.label === 'string' ? sanitizeStr(contact.label, 50) : def.label;
    const rawEmail = typeof contact.email === 'string' ? sanitizeEmail(contact.email) : '';
    const email = rawEmail || def.email;
    const links = Array.isArray(contact.links) ? contact.links.map(function(link) {
        if (!link || typeof link !== 'object') return null;
        const l = typeof link.label === 'string' ? sanitizeStr(link.label, 50) : '';
        const u = sanitizeLink(link.url);
        const i = typeof link.icon === 'string' ? sanitizeStr(link.icon, 50) : '';
        return l && u ? { label: l, url: u, icon: i } : null;
    }).filter(Boolean).slice(0, 10) : def.links;
    return { label: label, email: email, links: links.length ? links : def.links };
}

function validateFooter(footer) {
    const def = readDefaultConfig().footer;
    if (!footer || typeof footer !== 'object') return def;
    const copyright = typeof footer.copyright === 'string' ? sanitizeStr(footer.copyright, 100) : def.copyright;
    const showVisitorCounter = footer.showVisitorCounter === false ? false : true;
    return { copyright: copyright, showVisitorCounter: showVisitorCounter };
}

function validateNavigation(nav) {
    const def = readDefaultConfig().navigation;
    if (!nav || typeof nav !== 'object') return def;
    const logo = typeof nav.logo === 'string' ? sanitizeStr(nav.logo, 20) : def.logo;
    const items = Array.isArray(nav.items) ? nav.items.map(function(item) {
        if (!item || typeof item !== 'object') return null;
        const label = typeof item.label === 'string' ? sanitizeStr(item.label, 50) : '';
        const href = sanitizeHref(item.href);
        return label && href ? { label: label, href: href } : null;
    }).filter(Boolean).slice(0, 10) : def.items;
    return { logo: logo, items: items.length ? items : def.items };
}

function validateFireflies(ff) {
    const def = readDefaultConfig().fireflies;
    if (!ff || typeof ff !== 'object') return def;
    const count = {};
    Object.keys(def.count).forEach(function(key) {
        const v = ff.count && Number.isInteger(ff.count[key]) && ff.count[key] >= 0 ? ff.count[key] : def.count[key];
        count[key] = Math.min(v, 12);
    });
    const lightColors = Array.isArray(ff.lightColors) ? ff.lightColors.filter(function(c) { return typeof c === 'string' && HEX_COLOR.test(c); }).slice(0, 12) : def.lightColors;
    const darkColors = Array.isArray(ff.darkColors) ? ff.darkColors.filter(function(c) { return typeof c === 'string' && HEX_COLOR.test(c); }).slice(0, 12) : def.darkColors;
    return { count: count, lightColors: lightColors.length ? lightColors : def.lightColors, darkColors: darkColors.length ? darkColors : def.darkColors };
}

function validateCursor(cursor) {
    const def = readDefaultConfig().cursor;
    if (!cursor || typeof cursor !== 'object') return def;
    const enabled = cursor.enabled === false ? false : true;
    const dotSize = Number.isInteger(cursor.dotSize) && cursor.dotSize > 0 ? Math.min(cursor.dotSize, 32) : def.dotSize;
    const ringSize = Number.isInteger(cursor.ringSize) && cursor.ringSize > 0 ? Math.min(cursor.ringSize, 128) : def.ringSize;
    const color = typeof cursor.color === 'string' && HEX_COLOR.test(cursor.color) ? cursor.color : def.color;
    const blendMode = typeof cursor.blendMode === 'string' && ['difference', 'exclusion', 'normal'].indexOf(cursor.blendMode) !== -1 ? cursor.blendMode : def.blendMode;
    return { enabled: enabled, dotSize: dotSize, ringSize: ringSize, color: color, blendMode: blendMode };
}

function validateProjectsConfig(projects) {
    const def = readDefaultConfig().projects;
    if (!projects || typeof projects !== 'object') return def;
    const maxPerGroup = Number.isInteger(projects.maxPerGroup) && projects.maxPerGroup > 0 ? Math.min(projects.maxPerGroup, 100) : def.maxPerGroup;
    const sortOrder = typeof projects.sortOrder === 'string' && ['manual', 'date', 'title'].indexOf(projects.sortOrder) !== -1 ? projects.sortOrder : def.sortOrder;
    return { maxPerGroup: maxPerGroup, sortOrder: sortOrder };
}

function validateSeo(seo) {
    const def = readDefaultConfig().seo;
    if (!seo || typeof seo !== 'object') return def;
    const title = typeof seo.title === 'string' ? sanitizeStr(seo.title, 100) : def.title;
    const description = typeof seo.description === 'string' ? sanitizeStr(seo.description, 300) : def.description;
    const ogImage = typeof seo.ogImage === 'string' ? sanitizeLink(seo.ogImage) : def.ogImage;
    const siteUrl = typeof seo.siteUrl === 'string' ? sanitizeLink(seo.siteUrl) : def.siteUrl;
    const robots = typeof seo.robots === 'string' ? sanitizeStr(seo.robots, 50) : def.robots;
    return { title: title, description: description, ogImage: ogImage || def.ogImage, siteUrl: siteUrl || def.siteUrl, robots: robots };
}

function validateConfig(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return {
        theme: validateTheme(body.theme),
        hero: validateHero(body.hero),
        about: validateAbout(body.about),
        skills: validateSkills(body.skills),
        contact: validateContact(body.contact),
        footer: validateFooter(body.footer),
        navigation: validateNavigation(body.navigation),
        fireflies: validateFireflies(body.fireflies),
        cursor: validateCursor(body.cursor),
        projects: validateProjectsConfig(body.projects),
        seo: validateSeo(body.seo)
    };
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

async function writeConfig(data) {
    await put('config.json', JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true });
}

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        if (req.method === 'GET') {
            const data = await readConfig();
            return jsonRes(res, 200, data || readDefaultConfig());
        }

        if (req.method === 'POST') {
            const auth = req.headers.authorization || '';
            const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
            const session = await readSession(token);
            if (!session) return jsonRes(res, 401, { error: 'Unauthorized' });

            let body = parseRequestBody(req);
            if (!body) return jsonRes(res, 400, { error: 'Invalid or oversized JSON body' });

            const current = await readConfig();
            const currentVersion = getVersion(current);
            const requestedVersion = Number.isInteger(body.version) ? body.version : null;
            if (current && requestedVersion === null) return jsonRes(res, 409, { error: 'Config version required. Reload before saving.', version: currentVersion });
            if (requestedVersion !== null && requestedVersion !== currentVersion) return jsonRes(res, 409, { error: 'Config data changed. Reload before saving.', version: currentVersion });

            const validated = validateConfig(body);
            if (!validated) return jsonRes(res, 400, { error: 'Invalid config data' });

            if (current) await createBackup(current, currentVersion);
            validated.version = currentVersion + 1;
            validated.updatedAt = Date.now();
            await writeConfig(validated);
            await pruneBackups();
            return jsonRes(res, 200, { ok: true, version: validated.version, updatedAt: validated.updatedAt });
        }

        jsonRes(res, 405, { error: 'Method not allowed' });
    } catch (e) {
        jsonRes(res, 500, { error: 'Server error' });
    }
};
