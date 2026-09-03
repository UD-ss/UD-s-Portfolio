const { ImageResponse } = require('@vercel/og');
const React = require('react');

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
    const url = new URL(req.url, `https://${req.headers.host}`);
    const searchParams = url.searchParams;

    const title = searchParams.get('title') || 'UD';
    const subtitle = searchParams.get('subtitle') || 'Portfolio';
    const desc = searchParams.get('desc') || '느낌 있는 코딩과 높은 품질의 로직을 자연어로 설계하는 개발자';
    const theme = searchParams.get('theme') || 'dark';

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1c1e20' : '#ece7dd';
    const fgColor = isDark ? '#e6e3de' : '#211d18';
    const mutedColor = isDark ? '#9b968e' : '#8a8378';
    const pointColor = '#0055ff';

    const pretendard = await loadFont(
        'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable-DynamicSubset.ttf'
    );

    const fonts = [];
    if (pretendard) {
        fonts.push({ name: 'Pretendard', data: pretendard, weight: 400 });
        fonts.push({ name: 'Pretendard', data: pretendard, weight: 700 });
    }

    const imageResponse = new ImageResponse(
        React.createElement('div', {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '80px',
                backgroundColor: bgColor,
                color: fgColor,
                fontFamily: '"Pretendard", sans-serif',
                position: 'relative',
            },
        },
            React.createElement('div', {
                style: {
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '16px',
                    marginBottom: '8px',
                },
            },
                React.createElement('span', {
                    style: {
                        fontSize: '80px',
                        fontWeight: '700',
                        letterSpacing: '-2px',
                    },
                }, title),
                React.createElement('span', {
                    style: {
                        fontSize: '28px',
                        fontWeight: '400',
                        color: mutedColor,
                    },
                }, subtitle)
            ),
            React.createElement('div', {
                style: {
                    width: '60px',
                    height: '3px',
                    backgroundColor: pointColor,
                    marginBottom: '36px',
                    borderRadius: '2px',
                },
            }),
            React.createElement('p', {
                style: {
                    fontSize: '26px',
                    lineHeight: '1.7',
                    color: mutedColor,
                    maxWidth: '800px',
                    margin: 0,
                },
            }, desc),
            React.createElement('div', {
                style: {
                    position: 'absolute',
                    bottom: '60px',
                    right: '80px',
                    fontSize: '18px',
                    color: mutedColor,
                    letterSpacing: '1px',
                },
            }, 'portfolio.ud-ss.me')
        ),
        {
            width: 1200,
            height: 630,
            fonts,
        }
    );

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
    res.send(buffer);
};
