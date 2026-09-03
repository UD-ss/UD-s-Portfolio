const sharp = require('sharp');
const opentype = require('opentype.js');
const fs = require('fs');

let fontObj = null;

async function getFont() {
    if (fontObj) return fontObj;
    const res = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansCJKkr-Regular.otf');
    if (!res.ok) throw new Error('Failed to load font');
    const buf = Buffer.from(await res.arrayBuffer());
    fontObj = opentype.parse(buf.buffer);
    return fontObj;
}

function measureText(font, text, fontSize) {
    let width = 0;
    for (const char of text) {
        const glyph = font.charToGlyph(char);
        width += (glyph.advanceWidth || fontSize) * fontSize / font.unitsPerEm;
    }
    return width;
}

function textToPath(font, text, x, y, fontSize) {
    let pathData = '';
    let cursorX = x;

    for (const char of text) {
        const glyph = font.charToGlyph(char);
        if (glyph && glyph.path && glyph.path.commands.length > 0) {
            const path = glyph.getPath(cursorX, y, fontSize);
            pathData += path.toSVG(2).replace(/<\/?svg[^>]*>/g, '');
        }
        cursorX += (glyph.advanceWidth || fontSize * 0.5) * fontSize / font.unitsPerEm;
    }

    return pathData;
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
        const titlePath = textToPath(font, title, 80, 310, 80);
        const subtitlePath = textToPath(font, subtitle, 80 + titleW + 16, 310, 28);

        const descLine1 = desc.length > 30 ? desc.substring(0, 30) : desc;
        const descLine2 = desc.length > 30 ? desc.substring(30, 60) : '';
        const descPath1 = textToPath(font, descLine1, 80, 395, 26);
        const descPath2 = descLine2 ? textToPath(font, descLine2, 80, 431, 26) : '';

        const domain = 'portfolio.ud-ss.me';
        const domainW = measureText(font, domain, 18);
        const domainPath = textToPath(font, domain, 1120 - domainW, 578, 18);

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${bgColor}"/>
  <g fill="${fgColor}">${titlePath}</g>
  <g fill="${mutedColor}">${subtitlePath}</g>
  <rect x="80" y="340" width="60" height="3" rx="2" fill="${pointColor}"/>
  <g fill="${mutedColor}">${descPath1}</g>
  ${descPath2 ? `<g fill="${mutedColor}">${descPath2}</g>` : ''}
  <g fill="${mutedColor}">${domainPath}</g>
</svg>`;

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
