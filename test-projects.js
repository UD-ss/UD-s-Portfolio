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

const handler = require('./api/projects.js');
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
        if (e.actual !== undefined && e.expected !== undefined)
            console.log(`    expected: ${JSON.stringify(e.expected)} | actual: ${JSON.stringify(e.actual)}`);
    }
}

function makeSession(token) {
    return JSON.stringify({ token: token, createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
}

const VALID_TOKEN = 'a'.repeat(64);

(async () => {
    console.log('\n=== Projects API Tests ===\n');

    console.log('--- GET ---');

    await test('GET empty store → default projects', async () => {
        const r = res(); await handler(req('GET'), r);
        assert.strictEqual(r.statusCode, 200);
        assert(Array.isArray(r.body.highlighted));
        assert(Array.isArray(r.body.more));
        assert(r.body.highlighted.length >= 1);
    });

    await test('GET returns stored projects', async () => {
        const data = { highlighted: [{ id: 'test', title: 'Test', description: 'Desc', tags: [], image: '', link: '', placeholder: false }], more: [] };
        require('./test-mock-blob.js')._set({ 'projects.json': JSON.stringify(data) });
        const r = res(); await handler(req('GET'), r);
        assert.strictEqual(r.body.highlighted[0].id, 'test');
        assert.strictEqual(r.body.highlighted[0].title, 'Test');
    });

    console.log('\n--- POST (Auth) ---');

    await test('POST without token → 401', async () => {
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }), r);
        assert.strictEqual(r.statusCode, 401);
    });

    await test('POST with invalid token format → 401', async () => {
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }, 'short'), r);
        assert.strictEqual(r.statusCode, 401);
    });

    await test('POST with valid token but no session blob → 401', async () => {
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 401);
    });

    await test('POST with valid session → 200', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.ok, true);
    });

    await test('POST expired session → 401', async () => {
        const expired = JSON.stringify({ token: VALID_TOKEN, createdAt: Date.now(), expiresAt: Date.now() - 1 });
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: expired
        });
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 401);
    });

    console.log('\n--- POST (Validation) ---');

    await test('POST missing highlighted → 400', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const r = res(); await handler(req('POST', { more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST missing more → 400', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const r = res(); await handler(req('POST', { highlighted: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST highlighted not array → 400', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const r = res(); await handler(req('POST', { highlighted: 'string', more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST sanitizes HTML tags from title', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const data = {
            highlighted: [{ id: 'x', title: '<b>Bold</b>Text', description: 'Desc', tags: [], image: '', link: '', placeholder: false }],
            more: []
        };
        const r = res(); await handler(req('POST', data, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 200);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['projects.json']);
        assert.strictEqual(stored.highlighted[0].title, 'BoldText');
    });

    await test('POST strips javascript: scheme from links', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const data = {
            highlighted: [{ id: 'x', title: 'Test', description: 'Desc', tags: [], image: '', link: 'javascript:alert(1)', placeholder: false }],
            more: []
        };
        const r = res(); await handler(req('POST', data, VALID_TOKEN), r);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['projects.json']);
        assert.strictEqual(stored.highlighted[0].link, '');
    });

    await test('POST strips data: scheme from image', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const data = {
            highlighted: [{ id: 'x', title: 'Test', description: 'Desc', tags: [], image: 'data:text/html,<h1>x', link: '', placeholder: false }],
            more: []
        };
        const r = res(); await handler(req('POST', data, VALID_TOKEN), r);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['projects.json']);
        assert.strictEqual(stored.highlighted[0].image, '');
    });

    await test('POST allows https links', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const data = {
            highlighted: [{ id: 'x', title: 'Test', description: 'Desc', tags: [], image: 'https://example.com/img.png', link: 'https://example.com', placeholder: false }],
            more: []
        };
        const r = res(); await handler(req('POST', data, VALID_TOKEN), r);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['projects.json']);
        assert.strictEqual(stored.highlighted[0].link, 'https://example.com');
        assert.strictEqual(stored.highlighted[0].image, 'https://example.com/img.png');
    });

    await test('POST limits tags to 10', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const tags = Array.from({ length: 15 }, (_, i) => 'tag' + i);
        const data = {
            highlighted: [{ id: 'x', title: 'Test', description: 'Desc', tags: tags, image: '', link: '', placeholder: false }],
            more: []
        };
        const r = res(); await handler(req('POST', data, VALID_TOKEN), r);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['projects.json']);
        assert.strictEqual(stored.highlighted[0].tags.length, 10);
    });

    await test('POST strips vbscript: scheme', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN)
        });
        const data = {
            highlighted: [],
            more: [{ id: 'x', title: 'Test', description: 'Desc', tech: 'JS', link: 'VBScript:msgbox("x")' }]
        };
        const r = res(); await handler(req('POST', data, VALID_TOKEN), r);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['projects.json']);
        assert.strictEqual(stored.more[0].link, '');
    });

    console.log('\n--- Version, Backup, and Limits ---');

    await test('POST rejects missing version when data already exists', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN),
            'projects.json': JSON.stringify({ highlighted: [], more: [], version: 4 })
        });
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 409);
        assert.strictEqual(r.body.version, 4);
    });

    await test('POST rejects stale version with 409', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN),
            'projects.json': JSON.stringify({ highlighted: [], more: [], version: 4 })
        });
        const r = res(); await handler(req('POST', { highlighted: [], more: [], version: 3 }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 409);
        assert.strictEqual(r.body.version, 4);
    });

    await test('POST accepts current version and increments it', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN),
            'projects.json': JSON.stringify({ highlighted: [], more: [], version: 4 })
        });
        const r = res(); await handler(req('POST', { highlighted: [], more: [], version: 4 }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.version, 5);
        const store = require('./test-mock-blob.js')._getStore();
        assert.strictEqual(JSON.parse(store['projects.json']).version, 5);
        assert(Object.keys(store).some(function(key) { return /^projects\/backups\/4-\d+\.json$/.test(key); }));
    });

    await test('GET backups requires auth and returns newest first', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN),
            'projects/backups/9-200.json': JSON.stringify({ highlighted: [], more: [], version: 9 }),
            'projects/backups/10-300.json': JSON.stringify({ highlighted: [], more: [], version: 10 })
        });
        const unauthorized = res(); await handler({ method: 'GET', url: '/api/projects?backups=1', headers: {} }, unauthorized);
        assert.strictEqual(unauthorized.statusCode, 401);
        const r = res(); await handler({ method: 'GET', url: '/api/projects?backups=1', headers: { authorization: 'Bearer ' + VALID_TOKEN } }, r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.backups[0].version, 10);
    });

    await test('POST restore replaces data and creates next version', async () => {
        require('./test-mock-blob.js')._set({
            ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN),
            'projects.json': JSON.stringify({ highlighted: [{ id: 'new', title: 'New' }], more: [], version: 2 }),
            'projects/backups/1-100.json': JSON.stringify({ highlighted: [{ id: 'old', title: 'Old' }], more: [], version: 1 })
        });
        const r = res(); await handler(req('POST', { action: 'restore', backup: 'projects/backups/1-100.json', version: 2 }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.version, 3);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['projects.json']);
        assert.strictEqual(stored.highlighted[0].id, 'old');
        assert.strictEqual(stored.version, 3);
    });

    await test('POST rejects duplicate IDs across groups', async () => {
        require('./test-mock-blob.js')._set({ ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN) });
        const data = { highlighted: [{ id: 'same', title: 'A' }], more: [{ id: 'same', title: 'B' }] };
        const r = res(); await handler(req('POST', data, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST rejects more than 50 projects in a group', async () => {
        require('./test-mock-blob.js')._set({ ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN) });
        const highlighted = Array.from({ length: 51 }, function(_, i) { return { id: 'p' + i, title: 'P' + i }; });
        const r = res(); await handler(req('POST', { highlighted: highlighted, more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST rejects oversized JSON body', async () => {
        require('./test-mock-blob.js')._set({ ['sessions/' + VALID_TOKEN + '.json']: makeSession(VALID_TOKEN) });
        const r = res(); await handler(req('POST', { highlighted: [{ id: 'x', title: 'x', description: 'a'.repeat(1024 * 1024) }], more: [] }, VALID_TOKEN), r);
        assert.strictEqual(r.statusCode, 400);
    });

    console.log('\n--- HTTP Methods ---');

    await test('OPTIONS → 204', async () => {
        const r = res(); await handler(req('OPTIONS'), r);
        assert.strictEqual(r.statusCode, 204);
    });

    await test('DELETE → 405', async () => {
        const r = res(); await handler(req('DELETE'), r);
        assert.strictEqual(r.statusCode, 405);
    });

    console.log('\n--- CORS ---');

    await test('CORS headers set correctly', async () => {
        const r = res(); await handler(req('GET'), r);
        assert.strictEqual(r.hdrs['Access-Control-Allow-Origin'], 'https://portfolio.ud-ss.me');
        assert(r.hdrs['Access-Control-Allow-Methods'].includes('GET'));
        assert(r.hdrs['Access-Control-Allow-Methods'].includes('POST'));
    });

    console.log('\n--- Session Token Validation ---');

    await test('Token with non-hex chars → 401', async () => {
        const badToken = 'g'.repeat(64);
        require('./test-mock-blob.js')._set({
            ['sessions/' + badToken + '.json']: makeSession(badToken)
        });
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }, badToken), r);
        assert.strictEqual(r.statusCode, 401);
    });

    await test('Token with wrong length → 401', async () => {
        const shortToken = 'a'.repeat(32);
        const r = res(); await handler(req('POST', { highlighted: [], more: [] }, shortToken), r);
        assert.strictEqual(r.statusCode, 401);
    });

    console.log(`\n=== Results: ${P}/${T} passed, ${F} failed ===\n`);
    if (F > 0) process.exit(1);
})();
