const { ImageResponse } = require('@vercel/og');
const React = require('react');

module.exports = async (req, res) => {
    try {
        const element = React.createElement('div', {
            style: {
                width: '1200px',
                height: '630px',
                backgroundColor: '#1c1e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e6e3de',
                fontSize: '80px',
                fontWeight: 'bold',
            }
        }, 'Hello Korean 테스트');

        const response = new ImageResponse(element, {
            width: 1200,
            height: 630,
        });

        const buffer = Buffer.from(await response.arrayBuffer());

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(buffer);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e), stack: String(e && e.stack || '') });
    }
};
