const satori = require('satori');
const sharp = require('sharp');

let cachedFont = null;

async function getFont() {
    if (cachedFont) return cachedFont;
    const res = await fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.ttf');
    if (!res.ok) throw new Error('Font fetch failed: ' + res.status);
    cachedFont = await res.arrayBuffer();
    return cachedFont;
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

        const svg = await satori(
            {
                type: 'div',
                props: {
                    style: {
                        width: '1200px',
                        height: '630px',
                        backgroundColor: bgColor,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '80px',
                        fontFamily: 'Pretendard',
                    },
                    children: [
                        {
                            type: 'div',
                            props: {
                                style: { display: 'flex', alignItems: 'baseline', gap: '16px' },
                                children: [
                                    { type: 'div', props: { style: { fontSize: '80px', fontWeight: '700', color: fgColor, letterSpacing: '-2px' }, children: title } },
                                    { type: 'div', props: { style: { fontSize: '28px', color: mutedColor, marginLeft: '16px' }, children: subtitle } },
                                ]
                            }
                        },
                        {
                            type: 'div',
                            props: {
                                style: { width: '60px', height: '3px', backgroundColor: pointColor, borderRadius: '2px', marginTop: '24px', marginBottom: '24px' }
                            }
                        },
                        {
                            type: 'div',
                            props: {
                                style: { fontSize: '26px', color: mutedColor, lineHeight: '1.5' },
                                children: desc.length > 30 ? [desc.substring(0, 30), { type: 'br', props: {} }, desc.substring(30, 60)] : desc
                            }
                        },
                        {
                            type: 'div',
                            props: {
                                style: { fontSize: '18px', color: mutedColor, position: 'absolute', bottom: '52px', right: '80px' },
                                children: 'portfolio.ud-ss.me'
                            }
                        },
                    ]
                }
            },
            {
                width: 1200,
                height: 630,
                fonts: [
                    { name: 'Pretendard', data: fontData, style: 'normal', weight: '400' },
                    { name: 'Pretendard', data: fontData, style: 'normal', weight: '700' },
                ],
            }
        );

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
