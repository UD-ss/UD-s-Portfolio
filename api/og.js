const satori = require('satori');
const { Resvg } = require('@resvg/resvg-js');

async function loadFont(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
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

        const fontData = await loadFont(
            'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.ttf'
        );

        const svg = await satori(
            {
                type: 'div',
                props: {
                    style: {
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '80px',
                        backgroundColor: bgColor,
                        color: fgColor,
                        fontFamily: 'Pretendard, sans-serif',
                        position: 'relative',
                    },
                    children: [
                        {
                            type: 'div',
                            props: {
                                style: {
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: '16px',
                                    marginBottom: '8px',
                                },
                                children: [
                                    {
                                        type: 'span',
                                        props: {
                                            style: {
                                                fontSize: '80px',
                                                fontWeight: '700',
                                                letterSpacing: '-2px',
                                            },
                                            children: title,
                                        },
                                    },
                                    {
                                        type: 'span',
                                        props: {
                                            style: {
                                                fontSize: '28px',
                                                fontWeight: '400',
                                                color: mutedColor,
                                            },
                                            children: subtitle,
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            type: 'div',
                            props: {
                                style: {
                                    width: '60px',
                                    height: '3px',
                                    backgroundColor: pointColor,
                                    marginBottom: '36px',
                                    borderRadius: '2px',
                                },
                            },
                        },
                        {
                            type: 'p',
                            props: {
                                style: {
                                    fontSize: '26px',
                                    lineHeight: '1.7',
                                    color: mutedColor,
                                    maxWidth: '800px',
                                    margin: 0,
                                },
                                children: desc,
                            },
                        },
                        {
                            type: 'div',
                            props: {
                                style: {
                                    position: 'absolute',
                                    bottom: '60px',
                                    right: '80px',
                                    fontSize: '18px',
                                    color: mutedColor,
                                    letterSpacing: '1px',
                                },
                                children: 'portfolio.ud-ss.me',
                            },
                        },
                    ],
                },
            },
            {
                width: 1200,
                height: 630,
                fonts: fontData
                    ? [{ name: 'Pretendard', data: fontData, weight: 400, style: 'normal' }]
                    : [],
            }
        );

        const resvg = new Resvg(svg);
        const pngData = resvg.render();
        const buffer = pngData.asPng();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(buffer);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e) });
    }
};
