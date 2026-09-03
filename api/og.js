const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

let fontReady = null;

async function ensureFont() {
    if (fontReady) return fontReady;
    fontReady = (async () => {
        const fontDir = '/tmp/custom-fonts';
        const fontFile = path.join(fontDir, 'Pretendard.ttf');
        const confFile = path.join(fontDir, 'fonts.conf');

        if (!fs.existsSync(fontFile)) {
            fs.mkdirSync(fontDir, { recursive: true });
            const res = await fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.ttf');
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                fs.writeFileSync(fontFile, buf);
            }
        }

        if (!fs.existsSync(confFile)) {
            fs.writeFileSync(confFile, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/custom-fonts</dir>
</fontconfig>`);
        }

        process.env.FONTCONFIG_FILE = confFile;
    })();
    return fontReady;
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSvg(bgColor, fgColor, mutedColor, pointColor, title, subtitle, desc) {
    const titleWidth = title.length * 46;
    const descLine1 = desc.length > 30 ? desc.substring(0, 30) : desc;
    const descLine2 = desc.length > 30 ? desc.substring(30, 60) : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${bgColor}"/>
  <text x="80" y="300" font-family="Pretendard, sans-serif" font-size="80" font-weight="700" fill="${fgColor}" letter-spacing="-2">${escapeXml(title)}</text>
  <text x="${80 + titleWidth}" y="300" font-family="Pretendard, sans-serif" font-size="28" fill="${mutedColor}">  ${escapeXml(subtitle)}</text>
  <rect x="80" y="330" width="60" height="3" rx="2" fill="${pointColor}"/>
  <text x="80" y="390" font-family="Pretendard, sans-serif" font-size="26" fill="${mutedColor}">
    <tspan x="80" dy="0">${escapeXml(descLine1)}</tspan>
    ${descLine2 ? `<tspan x="80" dy="40">${escapeXml(descLine2)}</tspan>` : ''}
  </text>
  <text x="1120" y="570" font-family="Pretendard, sans-serif" font-size="18" fill="${mutedColor}" text-anchor="end" letter-spacing="1">portfolio.ud-ss.me</text>
</svg>`;
}

module.exports = async (req, res) => {
    try {
        await ensureFont();

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

        const svg = buildSvg(bgColor, fgColor, mutedColor, pointColor, title, subtitle, desc);
        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
