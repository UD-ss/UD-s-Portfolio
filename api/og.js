const { createCanvas, registerFont } = require('canvas');
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
        try {
            registerFont('/tmp/Pretendard.ttf', { family: 'Pretendard' });
        } catch {}
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

        const W = 1200, H = 630;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = pointColor;
        ctx.beginPath();
        ctx.roundRect(80, 340, 60, 3, 2);
        ctx.fill();

        ctx.fillStyle = fgColor;
        ctx.font = 'bold 80px Pretendard, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(title, 80, 250);

        const titleWidth = ctx.measureText(title).width;
        ctx.fillStyle = mutedColor;
        ctx.font = '28px Pretendard, sans-serif';
        ctx.fillText(subtitle, 80 + titleWidth + 16, 278);

        const descLine1 = desc.length > 30 ? desc.substring(0, 30) : desc;
        const descLine2 = desc.length > 30 ? desc.substring(30, 60) : '';
        ctx.font = '26px Pretendard, sans-serif';
        ctx.fillStyle = mutedColor;
        ctx.fillText(descLine1, 80, 375);
        if (descLine2) {
            ctx.fillText(descLine2, 80, 411);
        }

        ctx.font = '18px Pretendard, sans-serif';
        const domainW = ctx.measureText('portfolio.ud-ss.me').width;
        ctx.fillText('portfolio.ud-ss.me', W - 80 - domainW, 560);

        const buffer = canvas.toBuffer('image/png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(buffer);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
