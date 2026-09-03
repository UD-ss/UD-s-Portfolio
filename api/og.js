import { ImageResponse } from '@vercel/og';

export const config = {
    runtime: 'edge',
};

async function loadFont(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.arrayBuffer();
    } catch {
        return null;
    }
}

export default async function handler(req) {
    const { searchParams } = new URL(req.url);

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

    return new ImageResponse(
        (
            <div
                style={{
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
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '16px',
                        marginBottom: '8px',
                    }}
                >
                    <span
                        style={{
                            fontSize: '80px',
                            fontWeight: '700',
                            letterSpacing: '-2px',
                        }}
                    >
                        {title}
                    </span>
                    <span
                        style={{
                            fontSize: '28px',
                            fontWeight: '400',
                            color: mutedColor,
                        }}
                    >
                        {subtitle}
                    </span>
                </div>

                <div
                    style={{
                        width: '60px',
                        height: '3px',
                        backgroundColor: pointColor,
                        marginBottom: '36px',
                        borderRadius: '2px',
                    }}
                />

                <p
                    style={{
                        fontSize: '26px',
                        lineHeight: '1.7',
                        color: mutedColor,
                        maxWidth: '800px',
                        margin: 0,
                    }}
                >
                    {desc}
                </p>

                <div
                    style={{
                        position: 'absolute',
                        bottom: '60px',
                        right: '80px',
                        fontSize: '18px',
                        color: mutedColor,
                        letterSpacing: '1px',
                    }}
                >
                    portfolio.ud-ss.me
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            fonts,
        }
    );
}
