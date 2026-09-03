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
        const pointColor = isDark ? '#3b82f6' : '#0055ff';
        const glowColor = isDark ? 'rgba(59,130,246,0.12)' : 'rgba(0,85,255,0.08)';

        const { fontRegular, fontBold } = await getFonts();

        const titleFontSize = title.length <= 4 ? 160 : (title.length <= 10 ? 96 : 64);
        const titleW = measureText(fontBold, title, titleFontSize);
        const titleX = (1200 - titleW) / 2;
        const titleY = 315;
        const titleP = textToPath(fontBold, title, titleX, titleY, titleFontSize);

        const descLines = wrapText(desc, 24);
        const descSvgs = descLines.map((line, idx) => {
            const lw = measureText(fontRegular, line, 22);
            const lx = (1200 - lw) / 2;
            const ly = 408 + idx * 36;
            const lp = textToPath(fontRegular, line, lx, ly, 22);
            return `<g fill="${mutedColor}">${lp}</g>`;
        }).join('');

        const noiseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/></filter><rect width="200" height="200" filter="url(%23n)" opacity="${isDark ? '0.04' : '0.025'}"/></svg>`;
        const noiseBase64 = Buffer.from(noiseSvg).toString('base64');

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${bgColor2}"/>
    </linearGradient>
    <radialGradient id="glowCenter" cx="0.5" cy="0.48" r="0.5">
      <stop offset="0%" stop-color="${glowColor}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect width="1200" height="630" fill="url(#glowCenter)"/>
  <image href="data:image/svg+xml;base64,${noiseBase64}" width="1200" height="630"/>

  <circle cx="210" cy="180" r="16" fill="${pointColor}" opacity="0.22" filter="url(#softBlur)"/>
  <circle cx="210" cy="180" r="3" fill="${pointColor}" opacity="0.85"/>

  <circle cx="990" cy="160" r="18" fill="${pointColor}" opacity="0.24" filter="url(#softBlur)"/>
  <circle cx="990" cy="160" r="3" fill="${pointColor}" opacity="0.9"/>

  <circle cx="160" cy="460" r="15" fill="${pointColor}" opacity="0.2" filter="url(#softBlur)"/>
  <circle cx="160" cy="460" r="2.5" fill="${pointColor}" opacity="0.8"/>

  <circle cx="1040" cy="450" r="20" fill="${pointColor}" opacity="0.22" filter="url(#softBlur)"/>
  <circle cx="1040" cy="450" r="3.5" fill="${pointColor}" opacity="0.85"/>

  <circle cx="430" cy="490" r="14" fill="${pointColor}" opacity="0.18" filter="url(#softBlur)"/>
  <circle cx="430" cy="490" r="2.5" fill="${pointColor}" opacity="0.75"/>

  <circle cx="780" cy="130" r="15" fill="${pointColor}" opacity="0.2" filter="url(#softBlur)"/>
  <circle cx="780" cy="130" r="2.5" fill="${pointColor}" opacity="0.8"/>

  <g fill="${fgColor}">${titleP}</g>

  <line x1="568" y1="354" x2="632" y2="354" stroke="${fgColor}" stroke-width="1" stroke-opacity="0.2"/>

  ${descSvgs}
</svg>`;

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
