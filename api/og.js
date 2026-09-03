const sharp = require('sharp');
const opentype = require('opentype.js');

let fontRegular = null;
let fontBold = null;

async function getFonts() {
    if (fontRegular && fontBold) return { fontRegular, fontBold };
    const [regRes, boldRes] = await Promise.all([
        fetch('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Regular.woff'),
        fetch('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Bold.woff'),
    ]);
    if (!regRes.ok || !boldRes.ok) throw new Error('Font fetch failed');
    const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
    ]);
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
        const url = new URL(req.url, `https://${req.headers.host}`);
        const sp = url.searchParams;

        const title = sp.get('title') || 'UD';
        const desc = sp.get('desc') || '느낌 있는 코딩과 높은 품질의 로직을 자연어로 설계하는 개발자';
        const theme = sp.get('theme') || 'dark';

        const isDark = theme === 'dark';
        const bgColor = isDark ? '#1c1e20' : '#ece7dd';
        const bgColor2 = isDark ? '#242629' : '#e3ddd3';
        const fgColor = isDark ? '#e6e3de' : '#211d18';
        const mutedColor = isDark ? '#9b968e' : '#8a8378';

        const ffColors = isDark ? [
            '#3b82f6',
            '#06b6d4',
            '#818cf8',
            '#a78bfa',
            '#22d3ee',
            '#60a5fa'
        ] : [
            '#d4a574',
            '#e8917a',
            '#c9908f',
            '#c4886b',
            '#d4a08a',
            '#c9a07a'
        ];

        const { fontRegular, fontBold } = await getFonts();

        const titleFontSize = title.length <= 4 ? 160 : (title.length <= 10 ? 96 : 64);
        const titleW = measureText(fontBold, title, titleFontSize);
        const titleX = (1200 - titleW) / 2;
        const titleY = 300;
        const titleP = textToPath(fontBold, title, titleX, titleY, titleFontSize);

        const descLines = wrapText(desc, 24);
        const descSvgs = descLines.map((line, idx) => {
            const lw = measureText(fontRegular, line, 22);
            const lx = (1200 - lw) / 2;
            const ly = 392 + idx * 36;
            const lp = textToPath(fontRegular, line, lx, ly, 22);
            return `<g fill="${mutedColor}">${lp}</g>`;
        }).join('');

        const scrollLabel = textToPath(fontRegular, 'SCROLL', 0, 0, 11);
        const scrollW = measureText(fontRegular, 'SCROLL', 11);

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
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
