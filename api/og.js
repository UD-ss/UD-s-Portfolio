const sharp = require('sharp');
const fs = require('fs');

let fontReady = null;

async function ensureFont() {
    if (fontReady) return fontReady;
    fontReady = (async () => {
        if (!fs.existsSync('/tmp/Pretendard.ttf')) {
            const res = await fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.ttf');
            if (res.ok) {
                fs.writeFileSync('/tmp/Pretendard.ttf', Buffer.from(await res.arrayBuffer()));
            }
        }
    })();
    return fontReady;
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
        const font = '/tmp/Pretendard.ttf';

        const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${bgColor}"/>
  <rect x="80" y="340" width="60" height="3" rx="2" fill="${pointColor}"/>
</svg>`;

        const descLine1 = desc.length > 30 ? desc.substring(0, 30) : desc;
        const descLine2 = desc.length > 30 ? desc.substring(30, 60) : '';

        const composite = [
            { text: title, font, fontSize: 80, fontWeight: 'bold', top: 250, left: 80, color: fgColor },
            { text: subtitle, font, fontSize: 28, top: 280, left: 80 + (title.length * 46), color: mutedColor },
            { text: descLine1, font, fontSize: 26, top: 380, left: 80, color: mutedColor },
        ];

        if (descLine2) {
            composite.push({ text: descLine2, font, fontSize: 26, top: 416, left: 80, color: mutedColor });
        }

        composite.push({ text: 'portfolio.ud-ss.me', font, fontSize: 18, top: 560, left: 1040, color: mutedColor });

        const png = await sharp(Buffer.from(bgSvg))
            .composite(composite)
            .png()
            .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
