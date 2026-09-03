const sharp = require('sharp');

module.exports = async (req, res) => {
    try {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1c1e20"/>
  <rect x="80" y="260" width="200" height="80" fill="#e6e3de" rx="4"/>
  <rect x="80" y="340" width="60" height="3" rx="2" fill="#0055ff"/>
</svg>`;

        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
        res.status(200).send(png);
    } catch (e) {
        res.status(500).json({ error: String(e && e.message || e) });
    }
};
