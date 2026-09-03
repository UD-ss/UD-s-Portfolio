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
        const subtitle = sp.get('subtitle') || 'PORTFOLIO';
        const desc = sp.get('desc') || '느낌 있는 코딩과 높은 품질의 로직을 자연어로 설계하는 개발자';
        const theme = sp.get('theme') || 'dark';

        const isDark = theme === 'dark';
        const bgColor = isDark ? '#1c1e20' : '#ece7dd';
        const bgColor2 = isDark ? '#242629' : '#e3ddd3';
        const fgColor = isDark ? '#e6e3de' : '#211d18';
        const mutedColor = isDark ? '#9b968e' : '#8a8378';
        const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        const pointColor = isDark ? '#3b82f6' : '#0055ff';
        const cardBg = isDark ? 'rgba(36,38,41,0.72)' : 'rgba(255,253,249,0.75)';
        const pillBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
        const glowColor = isDark ? 'rgba(59,130,246,0.14)' : 'rgba(0,85,255,0.08)';

        const { fontRegular, fontBold } = await getFonts();

        const logoP = textToPath(fontBold, 'UD.', 0, 0, 24);
        const statusP = textToPath(fontRegular, 'AVAILABLE FOR PROJECTS', 0, 0, 11);
        const domainText = 'portfolio.ud-ss.me';
        const domainP = textToPath(fontRegular, domainText, 0, 0, 13);
        const domainW = measureText(fontRegular, domainText, 13);

        const kickerP = textToPath(fontBold, 'CREATIVE CODE & LOGIC DESIGN', 0, 0, 12);

        const titleFontSize = title.length <= 4 ? 108 : (title.length <= 10 ? 72 : 52);
        const titleY = title.length <= 4 ? 305 : (title.length <= 10 ? 292 : 282);
        const titleP = textToPath(fontBold, title, 0, 0, titleFontSize);
        const titleW = measureText(fontBold, title, titleFontSize);

        const subtitleFontSize = title.length <= 4 ? 26 : 20;
        const subtitleY = title.length <= 4 ? 275 : (titleY - 8);
        const subtitleP = textToPath(fontRegular, subtitle, 0, 0, subtitleFontSize);

        const descLines = wrapText(desc, 22);
        const descPaths = descLines.map((line) => textToPath(fontRegular, line, 0, 0, 23));

        const isDefault = title === 'UD';
        const cardLabel = isDefault ? 'IDENTITY / CORE VALUES' : 'PROJECT / SPECIFICATION';
        const cardLabelP = textToPath(fontBold, cardLabel, 0, 0, 11);

        const c1Key = isDefault ? '01  VIBE TO HIGH-QUALITY' : '01  PROJECT CONTEXT';
        const c1Val = isDefault ? '단순한 바이브 코딩을 뛰어넘는 고품질 로직 설계' : `${title} — Architecture & Deployment`;
        const c2Key = isDefault ? '02  NATURAL LANGUAGE LOGIC' : '02  ENGINEERED BY';
        const c2Val = isDefault ? '명확한 의도와 고밀도 프롬프트 아키텍처' : 'UD (Developer & Logic Architect)';
        const c3Key = isDefault ? '03  SEAMLESS INTERACTION' : '03  EXPERIENCE & STACK';
        const c3Val = isDefault ? 'GSAP 기반의 정밀하고 감각적인 원페이지 모션' : 'Interactive Motion & Robust Core Logic';

        const c1KeyP = textToPath(fontBold, c1Key, 0, 0, 11);
        const c1ValP = textToPath(fontRegular, c1Val, 0, 0, 13.5);
        const c2KeyP = textToPath(fontBold, c2Key, 0, 0, 11);
        const c2ValP = textToPath(fontRegular, c2Val, 0, 0, 13.5);
        const c3KeyP = textToPath(fontBold, c3Key, 0, 0, 11);
        const c3ValP = textToPath(fontRegular, c3Val, 0, 0, 13.5);

        const tags = ['Interactive Web', 'Creative Coding', 'AI Architecture', 'GSAP Motion'];
        let currentTagX = 64;
        const tagSvgs = tags.map((t) => {
            const tw = measureText(fontRegular, t, 12);
            const boxW = tw + 34;
            const p = textToPath(fontRegular, t, 0, 0, 12);
            const itemSvg = `<rect x="${currentTagX}" y="522" width="${boxW}" height="28" rx="14" fill="${pillBg}" stroke="${borderColor}" stroke-width="1"/><circle cx="${currentTagX + 13}" cy="536" r="2.5" fill="${pointColor}"/><g transform="translate(${currentTagX + 22}, 540)"><g fill="${mutedColor}">${p}</g></g>`;
            currentTagX += boxW + 12;
            return itemSvg;
        }).join('');

        const yearP = textToPath(fontRegular, '© 2026 UD. ALL RIGHTS RESERVED', 0, 0, 11);
        const yearW = measureText(fontRegular, '© 2026 UD. ALL RIGHTS RESERVED', 11);

        const noiseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/></filter><rect width="200" height="200" filter="url(%23n)" opacity="${isDark ? '0.04' : '0.025'}"/></svg>`;
        const noiseBase64 = Buffer.from(noiseSvg).toString('base64');

        const descSvgs = descPaths.map((p, idx) => {
            const yOffset = 385 + idx * 38;
            const fill = idx === 0 ? fgColor : mutedColor;
            return `<g transform="translate(64, ${yOffset})"><g fill="${fill}">${p}</g></g>`;
        }).join('');

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${bgColor2}"/>
    </linearGradient>
    <radialGradient id="glowMain" cx="0.25" cy="0.45" r="0.55">
      <stop offset="0%" stop-color="${glowColor}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="glowCard" cx="0.85" cy="0.4" r="0.45">
      <stop offset="0%" stop-color="${isDark ? 'rgba(59,130,246,0.08)' : 'rgba(0,85,255,0.05)'}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect width="1200" height="630" fill="url(#glowMain)"/>
  <rect width="1200" height="630" fill="url(#glowCard)"/>
  <image href="data:image/svg+xml;base64,${noiseBase64}" width="1200" height="630"/>

  <circle cx="160" cy="460" r="14" fill="${pointColor}" opacity="0.2" filter="url(#softBlur)"/>
  <circle cx="160" cy="460" r="2.5" fill="${pointColor}" opacity="0.8"/>

  <circle cx="580" cy="150" r="16" fill="${pointColor}" opacity="0.2" filter="url(#softBlur)"/>
  <circle cx="580" cy="150" r="3" fill="${pointColor}" opacity="0.85"/>

  <circle cx="1080" cy="180" r="22" fill="${pointColor}" opacity="0.22" filter="url(#softBlur)"/>
  <circle cx="1080" cy="180" r="3.5" fill="${pointColor}" opacity="0.9"/>

  <circle cx="640" cy="470" r="14" fill="${pointColor}" opacity="0.16" filter="url(#softBlur)"/>
  <circle cx="640" cy="470" r="2.5" fill="${pointColor}" opacity="0.75"/>

  <circle cx="1110" cy="490" r="18" fill="${pointColor}" opacity="0.2" filter="url(#softBlur)"/>
  <circle cx="1110" cy="490" r="3" fill="${pointColor}" opacity="0.8"/>

  <rect x="36" y="36" width="1128" height="558" rx="14" fill="none" stroke="${borderColor}" stroke-width="1"/>

  <g stroke="${pointColor}" stroke-width="1.5" opacity="0.55">
    <line x1="30" y1="36" x2="42" y2="36"/><line x1="36" y1="30" x2="36" y2="42"/>
    <line x1="1158" y1="36" x2="1170" y2="36"/><line x1="1164" y1="30" x2="1164" y2="42"/>
    <line x1="30" y1="594" x2="42" y2="594"/><line x1="36" y1="588" x2="36" y2="600"/>
    <line x1="1158" y1="594" x2="1170" y2="594"/><line x1="1164" y1="588" x2="1164" y2="600"/>
  </g>

  <g transform="translate(64, 94)">
    <g fill="${fgColor}">${logoP}</g>
  </g>

  <rect x="132" y="74" width="188" height="28" rx="14" fill="${pillBg}" stroke="${borderColor}" stroke-width="1"/>
  <circle cx="148" cy="88" r="3.5" fill="#10b981"/>
  <g transform="translate(160, 92)">
    <g fill="${mutedColor}">${statusP}</g>
  </g>

  <rect x="${1128 - (domainW + 40)}" y="74" width="${domainW + 40}" height="28" rx="14" fill="${pillBg}" stroke="${borderColor}" stroke-width="1"/>
  <circle cx="${1128 - (domainW + 40) + 16}" cy="88" r="3" fill="${pointColor}"/>
  <g transform="translate(${1128 - (domainW + 40) + 26}, 92)">
    <g fill="${mutedColor}">${domainP}</g>
  </g>

  <line x1="36" y1="120" x2="1164" y2="120" stroke="${borderColor}" stroke-width="1"/>

  <g transform="translate(64, 185)">
    <g fill="${pointColor}">${kickerP}</g>
  </g>

  <g transform="translate(60, ${titleY})">
    <g fill="${fgColor}">${titleP}</g>
  </g>
  <g transform="translate(${60 + titleW + 24}, ${subtitleY})">
    <g fill="${mutedColor}">${subtitleP}</g>
  </g>

  <rect x="64" y="332" width="48" height="3" rx="1.5" fill="${pointColor}"/>

  ${descSvgs}

  <rect x="636" y="152" width="492" height="316" rx="16" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
  <circle cx="664" cy="180" r="4.5" fill="#ef4444" opacity="0.75"/>
  <circle cx="680" cy="180" r="4.5" fill="#f59e0b" opacity="0.75"/>
  <circle cx="696" cy="180" r="4.5" fill="#10b981" opacity="0.75"/>

  <g transform="translate(718, 184)">
    <g fill="${mutedColor}">${cardLabelP}</g>
  </g>
  <line x1="636" y1="204" x2="1128" y2="204" stroke="${borderColor}" stroke-width="1"/>

  <g transform="translate(664, 238)">
    <g fill="${pointColor}">${c1KeyP}</g>
  </g>
  <g transform="translate(664, 263)">
    <g fill="${fgColor}">${c1ValP}</g>
  </g>

  <g transform="translate(664, 314)">
    <g fill="${pointColor}">${c2KeyP}</g>
  </g>
  <g transform="translate(664, 339)">
    <g fill="${fgColor}">${c2ValP}</g>
  </g>

  <g transform="translate(664, 390)">
    <g fill="${pointColor}">${c3KeyP}</g>
  </g>
  <g transform="translate(664, 415)">
    <g fill="${fgColor}">${c3ValP}</g>
  </g>

  <line x1="36" y1="492" x2="1164" y2="492" stroke="${borderColor}" stroke-width="1"/>

  ${tagSvgs}

  <g transform="translate(${1128 - yearW}, 541)">
    <g fill="${mutedColor}">${yearP}</g>
  </g>
</svg>`;

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
