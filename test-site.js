const assert = require('assert');
const fs = require('fs');
const path = require('path');

const site = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/site.json'), 'utf8'));
const projects = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/projects.json'), 'utf8'));
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
const vercelJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'));

const THEME_VARS = [
    'bg', 'fg', 'muted', 'cardBg', 'cardBorder', 'border', 'point',
    'highlightBg', 'highlightFg', 'highlightCard', 'listHoverBg',
    'preloaderBg', 'preloaderFg', 'glassBg', 'glassBorder',
    'cursorBlend', 'logoFilterBase', 'logoOpacityBase'
];
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_VALUE = /^[#a-zA-Z0-9(),.%\s_-]{1,80}$/;
const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const DANGEROUS_TAG = /<\/?(script|style|iframe|object|embed|form|input|svg|math|link|meta|base|video|audio|template)[^>]*>/i;

let P = 0, F = 0, T = 0;
let failures = [];

function test(name, fn) {
    T++;
    try {
        fn();
        P++;
        console.log(`  PASS  ${name}`);
    } catch (e) {
        F++;
        failures.push(name);
        console.log(`  FAIL  ${name}`);
        console.log(`        ${e.message}`);
    }
}

function safeLink(url) {
    if (typeof url !== 'string') return false;
    const v = url.trim();
    if (!v) return true;
    if (/[\r\n\t]/.test(v)) return false;
    if (/^(javascript|data|vbscript|file|blob):/i.test(v)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return /^https?:/i.test(v);
    return true;
}

function safeIcon(url) {
    if (typeof url !== 'string' || !url.trim()) return false;
    return /^(https?:\/\/|lucide:|data:image\/)/i.test(url.trim());
}

console.log('\n=== Static Site Data Tests ===\n');

console.log('--- data/site.json ---');

test('has every top-level section', () => {
    ['theme', 'hero', 'about', 'skills', 'contact', 'footer', 'navigation', 'fireflies', 'cursor', 'seo']
        .forEach(function(k) { assert.ok(site[k] && typeof site[k] === 'object', 'missing section: ' + k); });
});

test('both themes define the same 18 CSS variables', () => {
    ['light', 'dark'].forEach(function(mode) {
        assert.ok(site.theme[mode], 'missing theme: ' + mode);
        assert.deepStrictEqual(Object.keys(site.theme[mode]).sort(), [...THEME_VARS].sort(), 'theme vars mismatch: ' + mode);
    });
});

test('theme values are character-allowlisted CSS', () => {
    ['light', 'dark'].forEach(function(mode) {
        THEME_VARS.forEach(function(v) {
            const val = site.theme[mode][v];
            assert.ok(typeof val === 'string' && CSS_VALUE.test(val), `${mode}.${v} is not a safe CSS value: ${val}`);
        });
    });
});

test('hero names are short non-empty strings', () => {
    assert.ok(Array.isArray(site.hero.names) && site.hero.names.length > 0);
    site.hero.names.forEach(function(n) {
        assert.ok(typeof n === 'string' && n.length > 0 && n.length < 50, 'bad hero name: ' + n);
    });
    assert.ok(!/<\/?(?!br\s*\/?>)[a-z][^>]*>/i.test(site.hero.subtitle), 'hero.subtitle may only contain <br> tags');
});

test('about.html only uses safe tags', () => {
    assert.ok(!DANGEROUS_TAG.test(site.about.html), 'about.html contains a dangerous tag');
    assert.ok(!/\bon[a-z]+\s*=/i.test(site.about.html), 'about.html contains an inline event handler');
    assert.ok(!/(href|src)\s*=\s*["']?\s*(javascript|data|vbscript):/i.test(site.about.html), 'about.html contains a script URL');
});

test('skills categories are well formed', () => {
    assert.ok(Array.isArray(site.skills.categories) && site.skills.categories.length > 0);
    site.skills.categories.forEach(function(cat) {
        assert.ok(cat.title, 'category without title');
        assert.ok(HEX.test(cat.color), 'category color must be hex: ' + cat.color);
        assert.ok(Array.isArray(cat.items) && cat.items.length > 0, 'category without items: ' + cat.title);
        cat.items.forEach(function(item) {
            assert.ok(safeIcon(item.icon), 'unsafe icon: ' + item.icon);
            assert.ok(item.label, 'item without label');
        });
    });
});

test('contact email is valid and links are safe', () => {
    assert.ok(EMAIL.test(site.contact.email), 'invalid email: ' + site.contact.email);
    site.contact.links.forEach(function(l) {
        assert.ok(l.label, 'link without label');
        assert.ok(safeLink(l.url), 'unsafe link: ' + l.url);
    });
});

test('navigation hrefs are safe', () => {
    site.navigation.items.forEach(function(item) {
        assert.ok(item.label, 'nav item without label');
        assert.ok(safeLink(item.href), 'unsafe nav href: ' + item.href);
    });
});

test('fireflies counts and colors are bounded', () => {
    Object.keys(site.fireflies.count).forEach(function(k) {
        const v = site.fireflies.count[k];
        assert.ok(Number.isInteger(v) && v >= 0 && v <= 12, 'bad firefly count: ' + k);
    });
    ['lightColors', 'darkColors'].forEach(function(k) {
        assert.ok(Array.isArray(site.fireflies[k]) && site.fireflies[k].length > 0);
        site.fireflies[k].forEach(function(c) { assert.ok(HEX.test(c), 'firefly color must be hex: ' + c); });
    });
});

test('cursor geometry is bounded', () => {
    assert.ok(site.cursor.dotSize >= 1 && site.cursor.dotSize <= 32);
    assert.ok(site.cursor.ringSize >= 1 && site.cursor.ringSize <= 128);
    assert.ok(HEX.test(site.cursor.color));
    assert.ok(['difference', 'exclusion', 'normal'].includes(site.cursor.blendMode));
});

test('seo fields are safe', () => {
    assert.ok(site.seo.title && !/[<>]/.test(site.seo.title));
    assert.ok(site.seo.description && !/[<>]/.test(site.seo.description));
    assert.ok(safeLink(site.seo.ogImage) && /^https?:/.test(site.seo.ogImage), 'ogImage must be an absolute http(s) URL');
    assert.ok(/^https?:/.test(site.seo.siteUrl), 'siteUrl must be an absolute http(s) URL');
});

console.log('\n--- data/projects.json ---');

test('has highlighted and more arrays', () => {
    assert.ok(Array.isArray(projects.highlighted), 'highlighted must be an array');
    assert.ok(Array.isArray(projects.more), 'more must be an array');
});

test('project ids are unique and non-empty', () => {
    const ids = new Set();
    [...projects.highlighted, ...projects.more].forEach(function(p) {
        assert.ok(p.id && !ids.has(p.id), 'duplicate or empty id: ' + p.id);
        ids.add(p.id);
    });
});

test('project text fields contain no markup', () => {
    [...projects.highlighted, ...projects.more].forEach(function(p) {
        ['title', 'description', 'tech'].forEach(function(k) {
            if (p[k] === undefined) return;
            assert.ok(!/<[^>]*>/.test(p[k]), `${k} contains tags in ${p.id}: ${p[k]}`);
        });
    });
});

test('project links and images are safe', () => {
    [...projects.highlighted, ...projects.more].forEach(function(p) {
        assert.ok(safeLink(p.link), 'unsafe project link in ' + p.id + ': ' + p.link);
        if (p.image) assert.ok(safeLink(p.image), 'unsafe project image in ' + p.id + ': ' + p.image);
    });
});

console.log('\n--- architecture invariants ---');

test('content.js reads content from the API with a static fallback', () => {
    assert.ok(contentJs.includes("fetch('/api/content')"), 'content.js must fetch /api/content');
    assert.ok(contentJs.includes("fetch('/data/site.json')"), 'content.js must fall back to /data/site.json');
    assert.ok(contentJs.includes("fetch('/data/projects.json')"), 'content.js must fall back to /data/projects.json');
});

test('index.html has no inline scripts (CSP can drop unsafe-inline)', () => {
    const inline = indexHtml.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
    assert.deepStrictEqual(inline, [], 'inline scripts found: ' + inline.join(', '));
});

test('every local script referenced by index.html exists', () => {
    const refs = [...indexHtml.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)]
        .map(m => m[1])
        .filter(src => !/^(https?:)?\/\//.test(src));
    assert.ok(refs.length >= 4, 'expected the local scripts to be referenced, got ' + refs.length);
    refs.forEach(src => {
        assert.ok(fs.existsSync(path.join(__dirname, src)), 'missing script file: ' + src);
    });
});

test('no runtime admin or logging endpoints are referenced', () => {
    const removed = ['/api/config', '/api/projects', '/api/auth', '/api/upload', '/api/log', 'manage.html'];
    removed.forEach(function(p) {
        assert.ok(!indexHtml.includes(p), 'index.html still references ' + p);
        assert.ok(!scriptJs.includes(p), 'script.js still references ' + p);
        assert.ok(!contentJs.includes(p), 'content.js still references ' + p);
    });
});

test('only the content, counter and OG functions remain', () => {
    const files = fs.readdirSync(path.join(__dirname, 'api')).sort();
    assert.deepStrictEqual(files, ['content.js', 'counter.js', 'og.js']);
});

test('content.js sanitizes before it renders untrusted rich text', () => {
    assert.ok(contentJs.includes('new DOMParser()'), 'content.js must use DOMParser');
    assert.ok(contentJs.includes('sanitizeRichText(cfg.about.html'), 'about.html must go through sanitizeRichText');
    assert.ok(contentJs.includes("function safeHref"), 'content.js must allowlist href schemes');
    assert.ok(!contentJs.includes("indexOf('http') === 0"), 'content.js must allowlist image URLs');
});

test('vercel.json keeps the security headers', () => {
    const keys = vercelJson.headers.flatMap(function(h) { return h.headers.map(function(x) { return x.key + ':' + x.value; }); });
    assert.ok(keys.some(function(k) { return k.startsWith('X-Content-Type-Options'); }), 'missing nosniff');
    assert.ok(keys.some(function(k) { return k.startsWith('X-Frame-Options'); }), 'missing X-Frame-Options');
    const csp = keys.find(function(k) { return k.startsWith('Content-Security-Policy'); });
    assert.ok(csp, 'missing CSP');
    assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), 'script-src must not allow unsafe-inline');
    assert.ok(/script-src[^;]*'self'/.test(csp), 'script-src must allow the local scripts');
    assert.ok(/frame-ancestors 'none'/.test(csp), 'CSP must block framing');
    assert.ok(/object-src 'none'/.test(csp), 'CSP must block plugins');
});

test('vercel.json keeps the /admin proxy wiring, currently disabled', () => {
    const rewrites = vercelJson.rewrites || [];
    assert.ok(rewrites.some(function(r) { return r.source === '/admin/:path*' && /^https:\/\//.test(r.destination); }), 'admin rewrite must be preserved');
    assert.ok(rewrites.some(function(r) { return r.source === '/admin/'; }), 'missing /admin/ rewrite');
    const redirects = vercelJson.redirects || [];
    assert.ok(redirects.some(function(r) { return r.source === '/admin/:path*' && r.destination === '/'; }), 'admin must be disabled by a redirect to /');
});

test('the admin project is not part of the public repository', () => {
    assert.ok(!indexHtml.includes('admin'), 'index.html must not link to the admin project');
    assert.ok(!fs.existsSync(path.join(__dirname, 'manage.html')), 'manage.html must not be tracked here');
});

test('otpauth is no longer a dependency', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    assert.ok(!pkg.dependencies.otpauth, 'otpauth should be removed');
    assert.deepStrictEqual(Object.keys(pkg.dependencies).sort(), ['@vercel/blob', 'opentype.js', 'sharp']);
});

console.log(`\n=== Results: ${P}/${T} passed, ${F} failed ===`);
if (F > 0) {
    console.log('Failed: ' + failures.join(', ') + '\n');
    process.exit(1);
}
console.log('');
