const sharp = require('sharp');
const opentype = require('opentype.js');

let fontObj = null;

async function getFont() {
    if (fontObj) return fontObj;
    const res = await fetch('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Regular.woff');
    if (!res.ok) throw new Error('Font fetch failed: ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fontObj = opentype.parse(buf.buffer);
    return fontObj;
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
        const fgColor = isDark ? '#e6e3de' : '#211d18';
        const mutedColor = isDark ? '#9b968e' : '#8a8378';
        const pointColor = '#0055ff';

        const font = await getFont();

        const titleW = measureText(font, title, 80);
        const titleP = textToPath(font, title, 80, 310, 80);
        const subtitleP = textToPath(font, subtitle, 80 + titleW + 16, 310, 28);

        const dl1 = desc.length > 30 ? desc.substring(0, 30) : desc;
        const dl2 = desc.length > 30 ? desc.substring(30, 60) : '';
        const dp1 = textToPath(font, dl1, 80, 395, 26);
        const dp2 = dl2 ? textToPath(font, dl2, 80, 431, 26) : '';

        const dm = 'portfolio.ud-ss.me';
        const dmW = measureText(font, dm, 18);
        const dmP = textToPath(font, dm, 1120 - dmW, 578, 18);

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${bgColor}"/>
  <g fill="${fgColor}">${titleP}</g>
  <g fill="${mutedColor}">${subtitleP}</g>
  <rect x="80" y="340" width="60" height="3" rx="2" fill="${pointColor}"/>
  <g fill="${mutedColor}">${dp1}</g>
  ${dp2 ? `<g fill="${mutedColor}">${dp2}</g>` : ''}
  <g fill="${mutedColor}">${dmP}</g>
</svg>`;

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
