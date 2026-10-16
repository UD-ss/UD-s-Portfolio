const sharp = require('sharp');
const opentype = require('opentype.js');
const { list } = require('@vercel/blob');
const repoSite = require('../../data/site.json');

let fontRegular = null;
let fontBold = null;
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60000;

const SITE_KEYS = ['theme', 'hero', 'about', 'skills', 'contact', 'footer', 'navigation', 'fireflies', 'cursor', 'seo'];

async function readSite() {
    if (configCache && Date.now() - configCacheTime < CONFIG_CACHE_TTL) return configCache;
    try {
        const { blobs } = await list({ prefix: 'config.json' });
        const file = blobs.find(function(b) { return b.pathname === 'config.json'; });
        if (!file) return null;
        const r = await fetch(file.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
        if (!r.ok) return null;
        const data = await r.json();
        for (const key of SITE_KEYS) {
            if (!data || data[key] === undefined) return null;
        }
        configCache = data;
        configCacheTime = Date.now();
        return data;
    } catch (e) {
        return null;
    }
}

const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FALLBACK = {
    light: { bg: '#ece7dd', cardBg: '#e3ddd3', fg: '#211d18', muted: '#8a8378' },
    dark: { bg: '#1c1e20', cardBg: '#242629', fg: '#e6e3de', muted: '#9b968e' }
};
const FALLBACK_FIREFLIES = {
    light: ['#d4a574', '#e8917a', '#c9908f', '#c4886b', '#d4a08a', '#c9a07a'],
    dark: ['#3b82f6', '#06b6d4', '#818cf8', '#a78bfa', '#22d3ee', '#60a5fa']
};

function color(value, fallback) {
    return typeof value === 'string' && COLOR_RE.test(value.trim()) ? value.trim() : fallback;
}

function plain(value, maxLen) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maxLen);
}

function pick(list, fallbackList) {
    if (!Array.isArray(list)) return fallbackList;
    const out = list.map(function(c) { return color(c, null); }).filter(Boolean).slice(0, 6);
    return out.length ? out : fallbackList;
}

async function getFonts() {
    if (fontRegular && fontBold) return { fontRegular, fontBold };
    const [regRes, boldRes] = await Promise.all([
        fetch('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Regular.woff'),
        fetch('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Bold.woff'),
    ]);
    if (!regRes.ok || !boldRes.ok) throw new Error('Font fetch failed');
    const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
    fontRegular = opentype.parse(Buffer.from(regBuf).buffer);
    fontBold = opentype.parse(Buffer.from(boldBuf).buffer);
    return { fontRegular, fontBold };
}

function measureText(font, text, fontSize) {
    let w = 0;
    for (const c of text) {
        const g = font.charToGlyph(c);
        w += (g.advanceWidth || 600) * fontSize / font.unitsPerEm;
    }
    return w;
}

function textToPath(font, text, x, y, fontSize) {
    let d = '';
    let cx = x;
    for (const c of text) {
        const g = font.charToGlyph(c);
        if (g && g.path && g.path.commands.length > 0) {
            d += g.getPath(cx, y, fontSize).toSVG(3).replace(/<\/?svg[^>]*>/g, '');
        }
        cx += (g.advanceWidth || 600) * fontSize / font.unitsPerEm;
    }
    return d;
}

function wrapText(text, maxChars = 24) {
    if (text.length <= maxChars) return [text];
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
        if ((current + (current ? ' ' : '') + w).length <= maxChars) {
            current += (current ? ' ' : '') + w;
        } else {
            if (current) lines.push(current);
            current = w;
        }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
}

module.exports = async (req, res) => {
    try {
        const url = new URL(req.url || '/api/og', 'https://portfolio.ud-ss.me');
        const sp = url.searchParams;

        const site = (await readSite()) || repoSite;
        const seo = site.seo || {};
        const isDark = (sp.get('theme') || 'dark') === 'dark';
        const themeVars = (site.theme || {})[isDark ? 'dark' : 'light'] || {};
        const fb = isDark ? FALLBACK.dark : FALLBACK.light;

        const title = plain(sp.get('title') || seo.title || 'UD', 50);
        const desc = plain(sp.get('desc') || seo.description || '', 150);

        const bgColor = color(themeVars.bg, fb.bg);
        const bgColor2 = color(themeVars.cardBg, fb.cardBg);
        const fgColor = color(themeVars.fg, fb.fg);
        const mutedColor = color(themeVars.muted, fb.muted);

        const ff = site.fireflies || {};
        const ffColors = pick(isDark ? ff.darkColors : ff.lightColors, isDark ? FALLBACK_FIREFLIES.dark : FALLBACK_FIREFLIES.light);

        const { fontRegular, fontBold } = await getFonts();

        const titleFontSize = title.length <= 4 ? 160 : (title.length <= 10 ? 96 : 64);
        const titleW = measureText(fontBold, title, titleFontSize);
        const titleP = textToPath(fontBold, title, (1200 - titleW) / 2, 300, titleFontSize);

        const descSvgs = wrapText(desc, 24).map((line, idx) => {
            const lw = measureText(fontRegular, line, 22);
            const lp = textToPath(fontRegular, line, (1200 - lw) / 2, 392 + idx * 36, 22);
            return `<g fill="${mutedColor}">${lp}</g>`;
        }).join('');

        const scrollW = measureText(fontRegular, 'SCROLL', 11);
        const scrollLabel = textToPath(fontRegular, 'SCROLL', 0, 0, 11);

        const noiseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/></filter><rect width="200" height="200" filter="url(%23n)" opacity="${isDark ? '0.04' : '0.025'}"/></svg>`;
        const noiseBase64 = Buffer.from(noiseSvg).toString('base64');

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${bgColor2}"/>
    </linearGradient>
    <filter id="ffBlur" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="55"/>
    </filter>
    ${ffColors.map((c, i) => `
    <radialGradient id="ff${i + 1}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c}" stop-opacity="${isDark ? '0.65' : '0.55'}"/>
      <stop offset="65%" stop-color="${c}" stop-opacity="${isDark ? '0.2' : '0.15'}"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>`).join('')}
  </defs>

  <rect width="1200" height="630" fill="url(#bgGrad)"/>

  <circle cx="220" cy="180" r="180" fill="url(#ff1)" filter="url(#ffBlur)"/>
  <circle cx="940" cy="460" r="160" fill="url(#ff2)" filter="url(#ffBlur)"/>
  <circle cx="1060" cy="240" r="170" fill="url(#ff3)" filter="url(#ffBlur)"/>
  <circle cx="280" cy="500" r="150" fill="url(#ff4)" filter="url(#ffBlur)"/>
  <circle cx="720" cy="200" r="180" fill="url(#ff5)" filter="url(#ffBlur)"/>
  <circle cx="140" cy="340" r="150" fill="url(#ff6)" filter="url(#ffBlur)"/>

  <image href="data:image/svg+xml;base64,${noiseBase64}" width="1200" height="630"/>

  <g fill="${fgColor}">${titleP}</g>

  <line x1="568" y1="338" x2="632" y2="338" stroke="${fgColor}" stroke-width="1" stroke-opacity="0.2"/>

  ${descSvgs}

  <g transform="translate(${(1200 - scrollW) / 2}, 570)">
    <g fill="${mutedColor}" opacity="0.6">${scrollLabel}</g>
  </g>
  <line x1="600" y1="582" x2="600" y2="610" stroke="${fgColor}" stroke-width="1" stroke-opacity="0.2"/>
</svg>`;

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: 'Failed to generate OG image' });
    }
};
