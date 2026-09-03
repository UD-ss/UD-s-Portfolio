const { ImageResponse } = require('@vercel/og');
const React = require('react');

let cachedFont = null;

async function getFont() {
    if (cachedFont) return cachedFont;
    const urls = [
        'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.woff2',
        'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.ttf',
    ];
    for (const u of urls) {
        try {
            const r = await fetch(u);
            if (!r.ok) continue;
            const buf = await r.arrayBuffer();
            if (buf.byteLength < 1000) continue;
            cachedFont = buf;
            return cachedFont;
        } catch {}
    }
    throw new Error('No font loaded');
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

        const descLine1 = desc.length > 30 ? desc.substring(0, 30) : desc;
        const descLine2 = desc.length > 30 ? desc.substring(30, 60) : '';

        const element = React.createElement('div', {
            style: {
                width: '1200px',
                height: '630px',
                backgroundColor: bgColor,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '80px',
                position: 'relative',
                fontFamily: 'Pretendard',
            }
        },
            React.createElement('div', {
                style: { display: 'flex', alignItems: 'baseline' }
            },
                React.createElement('span', {
                    style: { fontSize: '80px', fontWeight: 700, color: fgColor, letterSpacing: '-2px' }
                }, title),
                React.createElement('span', {
                    style: { fontSize: '28px', color: mutedColor, marginLeft: '16px' }
                }, subtitle)
            ),
            React.createElement('div', {
                style: { width: '60px', height: '3px', backgroundColor: pointColor, borderRadius: '2px', marginTop: '24px', marginBottom: '24px' }
            }),
            React.createElement('div', {
                style: { fontSize: '26px', color: mutedColor, lineHeight: '1.5' }
            }, descLine1),
            descLine2 ? React.createElement('div', {
                style: { fontSize: '26px', color: mutedColor, lineHeight: '1.5' }
            }, descLine2) : null,
            React.createElement('div', {
                style: { fontSize: '18px', color: mutedColor, position: 'absolute', bottom: '52px', right: '80px' }
            }, 'portfolio.ud-ss.me')
        );

        const imageResponse = new ImageResponse(element, {
            width: 1200,
            height: 630,
            fonts: [
                { name: 'Pretendard', data: fontData, style: 'normal', weight: 400 },
                { name: 'Pretendard', data: fontData, style: 'normal', weight: 700 },
            ],
        });

        const buffer = Buffer.from(await imageResponse.arrayBuffer());

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(buffer);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
