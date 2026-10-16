const { list } = require('@vercel/blob');
const staticSite = require('../../data/site.json');
const staticProjects = require('../../data/projects.json');

const SITE_KEYS = ['theme', 'hero', 'about', 'skills', 'contact', 'footer', 'navigation', 'fireflies', 'cursor', 'seo'];
const PROJECT_KEYS = ['highlighted', 'more'];

async function readBlob(pathname) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
    try {
        const { blobs } = await list({ prefix: pathname });
        const file = blobs.find(function(b) { return b.pathname === pathname; });
        if (!file) return null;
        const r = await fetch(file.url, { headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } });
        if (!r.ok) return null;
        return await r.json();
    } catch (e) {
        return null;
    }
}

function complete(doc, keys) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
    for (const key of keys) {
        if (doc[key] === undefined || doc[key] === null) return null;
    }
    return doc;
}

module.exports = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const [siteBlob, projectsBlob] = await Promise.all([
        readBlob('config.json'),
        readBlob('projects.json')
    ]);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).json({
        site: complete(siteBlob, SITE_KEYS) || staticSite,
        projects: complete(projectsBlob, PROJECT_KEYS) || staticProjects,
        source: complete(siteBlob, SITE_KEYS) ? 'admin' : 'repo'
    });
};