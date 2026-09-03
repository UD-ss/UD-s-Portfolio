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
            d += g.getPath(cx, y, fontSize).toSVG(2).replace(/<\/?svg[^>]*>/g, '');
        }
        cx += (g.advanceWidth || 600) * fontSize / font.unitsPerEm;
    }
    return d;
}

module.exports = async (req, res) => {
    try {
        const url = new URL(req.url, `https://${req.headers.host}`);
        const sp = url.searchParams;

        const title = sp.get('title') || 'UD';
        const subtitle = sp.get('subtitle') || 'Portfolio';
        const desc = sp.get('desc') || '느낌 있는 코딩과 높은 품질의 로직을 자연어로 설계하는 개발자';
        const theme = sp.get('theme') || 'dark';

        const isDark = theme === 'dark';
        const bgColor = isDark ? '#1c1e20' : '#ece7dd';
        const bgColor2 = isDark ? '#242629' : '#e3ddd3';
        const fgColor = isDark ? '#e6e3de' : '#211d18';
        const mutedColor = isDark ? '#9b968e' : '#8a8378';
        const borderColor = isDark ? '#2b2d30' : '#ddd6ca';
        const pointColor = isDark ? '#3b82f6' : '#0055ff';
        const glowColor = isDark ? 'rgba(59,130,246,0.12)' : 'rgba(0,85,255,0.08)';
        const cardBg = isDark ? 'rgba(36,38,41,0.6)' : 'rgba(255,253,249,0.7)';

        const { fontRegular, fontBold } = await getFonts();

        const titleP = textToPath(fontBold, title, 0, 0, 96);
        const titleW = measureText(fontBold, title, 96);
        const subtitleP = textToPath(fontRegular, subtitle, 0, 0, 30);

        const dl1 = desc.length > 28 ? desc.substring(0, 28) : desc;
        const dl2 = desc.length > 28 ? desc.substring(28, 56) : '';
        const dl3 = desc.length > 56 ? desc.substring(56, 84) : '';
        const dp1 = textToPath(fontRegular, dl1, 0, 0, 22);
        const dp2 = dl2 ? textToPath(fontRegular, dl2, 0, 0, 22) : '';
        const dp3 = dl3 ? textToPath(fontRegular, dl3, 0, 0, 22) : '';

        const domainText = 'portfolio.ud-ss.me';
        const dmW = measureText(fontRegular, domainText, 15);
        const dmP = textToPath(fontRegular, domainText, 0, 0, 15);

        const noiseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/></filter><rect width="200" height="200" filter="url(%23n)" opacity="${isDark ? '0.04' : '0.03'}"/></svg>`;
        const noiseBase64 = Buffer.from(noiseSvg).toString('base64');

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${bgColor2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.15" cy="0.45" r="0.5">
      <stop offset="0%" stop-color="${glowColor}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.85" cy="0.2" r="0.4">
      <stop offset="0%" stop-color="${isDark ? 'rgba(59,130,246,0.06)' : 'rgba(0,85,255,0.04)'}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <clipPath id="cardClip">
      <rect x="60" y="170" width="520" height="300" rx="12"/>
    </clipPath>
  </defs>

  <rect width="1200" height="630" fill="url(%23bgGrad)"/>
  <rect width="1200" height="630" fill="url(%23glow)"/>
  <rect width="1200" height="630" fill="url(%23glow2)"/>
  <image href="data:image/svg+xml;base64,${noiseBase64}" width="1200" height="630" opacity="1"/>

  <rect x="60" y="170" width="520" height="300" rx="12" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>

  <g transform="translate(100, 230)">
    <g fill="${pointColor}">${titleP}</g>
  </g>
  <g transform="translate(${100 + titleW + 14}, 230)">
    <g fill="${mutedColor}">${subtitleP}</g>
  </g>

  <rect x="100" y="258" width="48" height="3" rx="1.5" fill="${pointColor}"/>

  <g transform="translate(100, 295)">
    <g fill="${mutedColor}">${dp1}</g>
  </g>
  ${dl2 ? `<g transform="translate(100, 324)"><g fill="${mutedColor}">${dp2}</g></g>` : ''}
  ${dl3 ? `<g transform="translate(100, 353)"><g fill="${mutedColor}">${dp3}</g></g>` : ''}

  <circle cx="1060" cy="200" r="80" fill="none" stroke="${borderColor}" stroke-width="1" opacity="0.5"/>
  <circle cx="1060" cy="200" r="120" fill="none" stroke="${borderColor}" stroke-width="0.5" opacity="0.3"/>
  <circle cx="1060" cy="200" r="4" fill="${pointColor}"/>

  <circle cx="1100" cy="400" r="40" fill="none" stroke="${borderColor}" stroke-width="0.5" opacity="0.3"/>

  <g transform="translate(${1120 - dmW}, 580)">
    <g fill="${mutedColor}">${dmP}</g>
  </g>

  <line x1="60" y1="560" x2="1140" y2="560" stroke="${borderColor}" stroke-width="0.5" opacity="0.4"/>
</svg>`;

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
