const assert = require('assert');
const Module = require('module');
const path = require('path');

const originalResolve = Module._resolveFilename;
const mockBlobPath = path.resolve(__dirname, 'test-mock-blob.js');

Module._resolveFilename = function(request) {
    if (request === '@vercel/blob') return mockBlobPath;
    return originalResolve.apply(this, arguments);
};

global.fetch = async function(url, opts) {
    if (url && url.startsWith('mock://')) {
        const key = url.replace('mock://', '');
        const data = require('./test-mock-blob.js')._getStore()[key];
        if (data) return { ok: true, json: async () => JSON.parse(data), status: 200 };
        return { ok: false, status: 404 };
    }
    return { ok: false, status: 404 };
};

const handler = require('./api/config.js');
Module._resolveFilename = originalResolve;

function req(method, body, token) {
    const r = { method, headers: {} };
    if (body) r.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (token) r.headers['authorization'] = 'Bearer ' + token;
    return r;
}

function res() {
    let _s = 200, _b = null, _e = false; const _h = {};
    const r = {
        setHeader: (k, v) => { _h[k] = v; },
        status: (c) => { _s = c; return r; },
        json: (d) => { _b = d; _e = true; return r; },
        end: () => { _e = true; },
        get statusCode() { return _s; },
        get body() { return _b; },
        get ended() { return _e; },
        get hdrs() { return _h; }
    };
    return r;
}

let P = 0, F = 0, T = 0;

async function test(name, fn) {
    T++;
    try {
        require('./test-mock-blob.js')._reset();
        await fn();
        P++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        F++;
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
    }
}

const VALID_TOKEN = 'a'.repeat(64);

async function seedSession(token) {
    const mockBlob = require('./test-mock-blob.js');
    const session = { token: token, createdAt: Date.now(), expiresAt: Date.now() + 86400000 };
    await mockBlob.put('sessions/' + token + '.json', JSON.stringify(session));
}

function validConfig() {
    return {
        version: 0,
        theme: {
            light: { bg: '#ece7dd', fg: '#211d18', muted: '#8a8378', cardBg: 'rgba(255,253,249,0.85)', cardBorder: '#ddd6ca', border: '#d8d1c4', point: '#0055ff', highlightBg: '#211d18', highlightFg: '#ece7dd', highlightCard: '#2c2720', listHoverBg: 'rgba(0,85,255,0.04)', preloaderBg: '#ece7dd', preloaderFg: '#211d18', glassBg: 'rgba(255,253,249,0.7)', glassBorder: 'rgba(0,0,0,0.08)', cursorBlend: 'difference', logoFilterBase: 'grayscale(1)', logoOpacityBase: '0.5' },
            dark: { bg: '#1c1e20', fg: '#e6e3de', muted: '#9b968e', cardBg: 'rgba(36,38,41,0.75)', cardBorder: '#2b2d30', border: '#27292b', point: '#3b82f6', highlightBg: '#151719', highlightFg: '#e6e3de', highlightCard: '#26282b', listHoverBg: 'rgba(59,130,246,0.08)', preloaderBg: '#1c1e20', preloaderFg: '#e6e3de', glassBg: 'rgba(255,255,255,0.06)', glassBorder: 'rgba(255,255,255,0.09)', cursorBlend: 'difference', logoFilterBase: 'grayscale(1)', logoOpacityBase: '0.4' }
        },
        hero: { names: ['UD', 'Test'], subtitle: 'Test subtitle', nameCyclingInterval: 3000 },
        about: { label: 'About', html: '<p>Hello</p>' },
        skills: { label: 'Skills', categories: [{ title: 'Frontend', color: '#3178c6', items: [{ icon: 'https://example.com/icon.svg', label: 'React' }] }] },
        contact: { label: 'Contact', email: 'test@test.com', links: [{ label: 'GitHub', url: 'https://github.com', icon: 'github' }] },
        footer: { copyright: '© 2026 test', showVisitorCounter: true },
        navigation: { logo: 'T.', items: [{ label: 'About', href: '#about' }] },
        fireflies: { count: { hero: 6, about: 3, skills: 3, contact: 3 }, lightColors: ['#d4a574ee'], darkColors: ['#3b82f6bb'] },
        cursor: { enabled: true, dotSize: 8, ringSize: 40, color: '#ffffff', blendMode: 'difference' },
        projects: { maxPerGroup: 50, sortOrder: 'manual' },
        seo: { title: 'Test', description: 'Test desc', ogImage: 'https://example.com/og.png', siteUrl: 'https://example.com', robots: 'noindex' }
    };
}

(async function() {
    console.log('\n📋 Config API Tests\n');

    // ── CORS & Methods ──

    await test('OPTIONS → 204 with CORS headers', async () => {
        const r = req('OPTIONS');
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 204);
        assert.strictEqual(s.hdrs['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
    });

    await test('unsupported method → 405', async () => {
        const r = req('DELETE');
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 405);
    });

    // ── GET ──

    await test('GET returns default config when no config.json exists', async () => {
        const r = req('GET');
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        assert.ok(s.body.version === 0);
        assert.ok(s.body.hero);
        assert.ok(Array.isArray(s.body.hero.names));
        assert.ok(s.body.theme.light);
        assert.ok(s.body.theme.dark);
        assert.ok(s.body.skills.categories.length > 0);
        assert.strictEqual(s.body.seo.title, 'UD | Portfolio');
    });

    await test('GET returns stored config when config.json exists', async () => {
        const cfg = validConfig();
        cfg.version = 5;
        const mockBlob = require('./test-mock-blob.js');
        await mockBlob.put('config.json', JSON.stringify(cfg));
        const r = req('GET');
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        assert.strictEqual(s.body.version, 5);
        assert.strictEqual(s.body.hero.subtitle, 'Test subtitle');
    });

    // ── POST Authentication ──

    await test('POST without token → 401', async () => {
        const r = req('POST', validConfig());
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 401);
    });

    await test('POST with invalid token → 401', async () => {
        const r = req('POST', validConfig(), 'invalid-token');
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 401);
    });

    await test('POST with expired session → 401', async () => {
        const mockBlob = require('./test-mock-blob.js');
        const session = { token: VALID_TOKEN, createdAt: Date.now() - 200000000, expiresAt: Date.now() - 1 };
        await mockBlob.put('sessions/' + VALID_TOKEN + '.json', JSON.stringify(session));
        const r = req('POST', validConfig(), VALID_TOKEN);
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 401);
    });

    // ── POST Success ──

    await test('POST with valid session creates config (version 0 → 1)', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        assert.strictEqual(s.body.ok, true);
        assert.strictEqual(s.body.version, 1);
        assert.ok(s.body.updatedAt > 0);
    });

    await test('POST with correct version increments', async () => {
        await seedSession(VALID_TOKEN);
        const mockBlob = require('./test-mock-blob.js');
        const existing = validConfig();
        existing.version = 3;
        await mockBlob.put('config.json', JSON.stringify(existing));
        const cfg = validConfig();
        cfg.version = 3;
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        assert.strictEqual(s.body.version, 4);
    });

    // ── Version Conflict ──

    await test('POST rejects missing version when data exists → 409', async () => {
        await seedSession(VALID_TOKEN);
        const mockBlob = require('./test-mock-blob.js');
        const existing = validConfig();
        existing.version = 5;
        await mockBlob.put('config.json', JSON.stringify(existing));
        const cfg = validConfig();
        delete cfg.version;
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 409);
        assert.strictEqual(s.body.version, 5);
    });

    await test('POST rejects stale version → 409', async () => {
        await seedSession(VALID_TOKEN);
        const mockBlob = require('./test-mock-blob.js');
        const existing = validConfig();
        existing.version = 10;
        await mockBlob.put('config.json', JSON.stringify(existing));
        const cfg = validConfig();
        cfg.version = 5;
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 409);
        assert.strictEqual(s.body.version, 10);
    });

    // ── Validation ──

    await test('POST with invalid body → 400', async () => {
        await seedSession(VALID_TOKEN);
        const r = req('POST', 'not json');
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 400);
    });

    await test('POST with non-object body → 400', async () => {
        await seedSession(VALID_TOKEN);
        const r = req('POST', { version: 0 });
        r.body = '"just a string"';
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 400);
    });

    await test('POST fills missing sections with defaults', async () => {
        await seedSession(VALID_TOKEN);
        const minimal = { version: 0, hero: { names: ['X'], subtitle: 'Hi', nameCyclingInterval: 2000 } };
        const r = req('POST', minimal);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        // Verify stored config has all sections
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.ok(stored.theme.light.bg);
        assert.ok(stored.skills.categories.length > 0);
        assert.ok(stored.footer.copyright);
        assert.ok(stored.seo.title);
    });

    // ── Theme Validation ──

    await test('theme validation: invalid color falls back to default', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.theme.light.bg = 'not-a-color-at-all-'.repeat(20);
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.theme.light.bg.length < 200, true);
    });

    // ── Hero Validation ──

    await test('hero validation: interval too small falls back to default', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.hero.nameCyclingInterval = 100;
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.hero.nameCyclingInterval, 3500); // default
    });

    await test('hero validation: names limited to 10', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.hero.names = Array(20).fill('X');
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.ok(stored.hero.names.length <= 10);
    });

    // ── Skills Validation ──

    await test('skills validation: categories limited to 10, items to 20', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.skills.categories = Array(15).fill(null).map((_, i) => ({
            title: 'Cat ' + i,
            color: '#ff0000',
            items: Array(25).fill(null).map((_, j) => ({ icon: 'https://x.com/' + j + '.svg', label: 'Item ' + j }))
        }));
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.ok(stored.skills.categories.length <= 10);
        assert.ok(stored.skills.categories[0].items.length <= 20);
    });

    await test('skills validation: invalid hex color falls back', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.skills.categories = [{ title: 'Test', color: 'not-hex', items: [{ icon: 'https://x.com/i.svg', label: 'X' }] }];
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.skills.categories[0].color, '#666666');
    });

    // ── Contact Validation ──

    await test('contact validation: javascript: URLs are stripped', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.contact.links = [
            { label: 'Good', url: 'https://github.com', icon: 'github' },
            { label: 'Bad', url: 'javascript:alert(1)', icon: 'x' }
        ];
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.contact.links.length, 1);
        assert.strictEqual(stored.contact.links[0].label, 'Good');
    });

    // ── Navigation Validation ──

    await test('navigation validation: items limited to 10', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.navigation.items = Array(15).fill(null).map((_, i) => ({ label: 'L' + i, href: '#s' + i }));
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.ok(stored.navigation.items.length <= 10);
    });

    // ── Cursor Validation ──

    await test('cursor validation: invalid blend mode falls back', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.cursor.blendMode = 'invalid';
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.cursor.blendMode, 'difference');
    });

    await test('cursor validation: dotSize clamped to 32', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.cursor.dotSize = 100;
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.cursor.dotSize, 32);
    });

    // ── Fireflies Validation ──

    await test('fireflies validation: count clamped to 12', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.fireflies.count.hero = 50;
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.fireflies.count.hero, 12);
    });

    // ── Projects Config Validation ──

    await test('projects config: maxPerGroup clamped to 100', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.projects.maxPerGroup = 200;
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.projects.maxPerGroup, 100);
    });

    await test('projects config: invalid sortOrder falls back', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.projects.sortOrder = 'random';
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.strictEqual(stored.projects.sortOrder, 'manual');
    });

    // ── SEO Validation ──

    await test('seo validation: script tags stripped from title', async () => {
        await seedSession(VALID_TOKEN);
        const cfg = validConfig();
        cfg.seo.title = '<script>alert(1)</script>Test';
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const mockBlob = require('./test-mock-blob.js');
        const stored = JSON.parse(mockBlob._getStore()['config.json']);
        assert.ok(!stored.seo.title.includes('<script>'));
    });

    // ── Backup ──

    await test('POST creates backup of existing config', async () => {
        await seedSession(VALID_TOKEN);
        const mockBlob = require('./test-mock-blob.js');
        const existing = validConfig();
        existing.version = 1;
        await mockBlob.put('config.json', JSON.stringify(existing));
        const cfg = validConfig();
        cfg.version = 1;
        cfg.hero.subtitle = 'Updated';
        const r = req('POST', cfg);
        r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 200);
        const store = mockBlob._getStore();
        const backups = Object.keys(store).filter(k => k.startsWith('config/backups/'));
        assert.ok(backups.length >= 1, 'backup should exist');
    });

    // ── Size Limit ──

    await test('POST rejects oversized body → 400', async () => {
        await seedSession(VALID_TOKEN);
        const r = { method: 'POST', headers: { 'authorization': 'Bearer ' + VALID_TOKEN } };
        r.body = JSON.stringify({ version: 0, padding: 'x'.repeat(1024 * 1024 + 1) });
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.statusCode, 400);
    });

    // ── CORS headers ──

    await test('CORS headers set on all responses', async () => {
        const r = req('GET');
        const s = res();
        await handler(r, s);
        assert.strictEqual(s.hdrs['Access-Control-Allow-Origin'], 'https://portfolio.ud-ss.me');
    });

    console.log(`\n  Results: ${P} passed, ${F} failed, ${T} total\n`);
    if (F > 0) process.exit(1);
})();
