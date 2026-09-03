const sharp = require('sharp');
const opentype = require('opentype.js');
const fs = require('fs');

let fontBuffer = null;

async function getFont() {
    if (fontBuffer) return fontBuffer;
    const res = await fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.ttf');
    if (!res.ok) throw new Error('Failed to load font');
    fontBuffer = Buffer.from(await res.arrayBuffer());
    return fontBuffer;
}

function textToPath(font, text, x, y, fontSize, fontWeight) {
    const weight = fontWeight === 'bold' ? 700 : 400;
    let pathData = '';
    let cursorX = x;

    for (const char of text) {
        const glyph = font.charToGlyph(char);
        if (glyph && glyph.path) {
            const path = glyph.getPath(cursorX, y, fontSize);
            pathData += path.toSVG(2).replace(/<\/?svg[^>]*>/g, '');
            cursorX += glyph.advanceWidth * fontSize / font.unitsPerEm;
        } else {
            cursorX += fontSize * 0.5;
        }
    }

    return `<path d="${pathData}" fill="currentColor"/>`;
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

        const fontData = await getFont();
        const font = opentype.parse(fontData.buffer);

        const titlePath = textToPath(font, title, 80, 310, 80, 'bold');
        const titleWidth = font.getAdvanceWidth(title, 80, { fontSize: 80, fontFamily: 'Pretendard' });
        const subtitlePath = textToPath(font, subtitle, 80 + titleWidth + 16, 310, 28, 'normal');

        const descLine1 = desc.length > 30 ? desc.substring(0, 30) : desc;
        const descLine2 = desc.length > 30 ? desc.substring(30, 60) : '';
        const descPath1 = textToPath(font, descLine1, 80, 395, 26, 'normal');
        const descPath2 = descLine2 ? textToPath(font, descLine2, 80, 431, 26, 'normal') : '';

        const domain = 'portfolio.ud-ss.me';
        const domainWidth = font.getAdvanceWidth(domain, 0, { fontSize: 18, fontFamily: 'Pretendard' });
        const domainPath = textToPath(font, domain, 1120 - domainWidth, 578, 18, 'normal');

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
