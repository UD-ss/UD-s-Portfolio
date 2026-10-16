const assert = require('assert');
const crypto = require('crypto');
const Module = require('module');

const store = new Map();
const mockBlob = {
    async list({ prefix }) {
        const blobs = [];
        for (const pathname of store.keys()) {
            if (pathname.startsWith(prefix)) blobs.push({ pathname, url: 'mock://' + pathname });
        }
        return { blobs };
    },
    async put(pathname, data) {
        store.set(pathname, data);
        return { pathname, url: 'mock://' + pathname };
    },
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request) {
    if (request === '@vercel/blob') return 'mock-blob';
    return originalResolve.apply(this, arguments);
};
require.cache['mock-blob'] = { id: 'mock-blob', filename: 'mock-blob', loaded: true, exports: mockBlob };

global.fetch = async function(url) {
    if (url && url.startsWith('mock://')) {
        const data = store.get(url.replace('mock://', ''));
        if (data === undefined) return { ok: false, status: 404 };
        return { ok: true, status: 200, json: async () => JSON.parse(data) };
    }
    return { ok: false, status: 404 };
};

const handler = require('./api/counter.js');
Module._resolveFilename = originalResolve;

const IP_SALT = 'ud-portfolio-counter-v1';
function ipKey(ip) {
    return crypto.createHash('sha256').update(IP_SALT + '|' + ip).digest('hex').slice(0, 32);
}
function today() { return new Date().toISOString().slice(0, 10); }

function req(method, ip) {
    return { method, headers: { 'x-real-ip': ip } };
}

function res() {
    let _s = 200, _b = null, _e = false; const _h = {};
    const r = {
        setHeader: (k, v) => { _h[k] = v; },
        status: (c) => { _s = c; return r; },
        json: (d) => { _b = d; _e = true; return r; },
        end: () => { _e = true; },
        send: (d) => { _b = d; _e = true; return r; },
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
    store.clear();
    try {
        await fn();
        P++;
        console.log(`  PASS  ${name}`);
    } catch (e) {
        F++;
        console.log(`  FAIL  ${name}`);
        console.log(`        ${e.message}`);
    }
}

let ipCounter = 0;
function freshIP() { return `10.0.0.${++ipCounter}`; }

(async () => {
    console.log('\n=== Counter API Tests ===\n');

    console.log('--- GET ---');

    await test('GET without stored data returns zeros', async () => {
        const r = res(); await handler(req('GET', freshIP()), r);
        assert.strictEqual(r.statusCode, 200);
        assert.deepStrictEqual(r.body, { total: 0, today: 0 });
    });

    await test('GET returns stored totals', async () => {
        store.set('counter.json', JSON.stringify({ total: 42, today: 7, date: today() }));
        const r = res(); await handler(req('GET', freshIP()), r);
        assert.deepStrictEqual(r.body, { total: 42, today: 7 });
    });

    await test('GET resets today on date change', async () => {
        store.set('counter.json', JSON.stringify({ total: 42, today: 7, date: '2000-01-01' }));
        const r = res(); await handler(req('GET', freshIP()), r);
        assert.deepStrictEqual(r.body, { total: 42, today: 0 });
    });

    await test('GET is not cached and reports not counted', async () => {
        const r = res(); await handler(req('GET', freshIP()), r);
        assert.strictEqual(r.hdrs['Cache-Control'], 'no-store');
        assert.strictEqual(r.hdrs['X-Counted'], '0');
    });

    await test('GET sends no CORS header (same-origin only)', async () => {
        const r = res(); await handler(req('GET', freshIP()), r);
        assert.strictEqual(r.hdrs['Access-Control-Allow-Origin'], undefined);
    });

    console.log('\n--- POST ---');

    await test('POST increments total and today', async () => {
        store.set('counter.json', JSON.stringify({ total: 10, today: 2, date: today() }));
        const r = res(); await handler(req('POST', freshIP()), r);
        assert.deepStrictEqual(r.body, { total: 11, today: 3 });
        assert.strictEqual(r.hdrs['X-Counted'], '1');
    });

    await test('POST on empty store starts from 1', async () => {
        const r = res(); await handler(req('POST', freshIP()), r);
        assert.deepStrictEqual(r.body, { total: 1, today: 1 });
    });

    await test('POST after date change keeps total and resets today', async () => {
        store.set('counter.json', JSON.stringify({ total: 99, today: 50, date: '2000-01-01' }));
        const r = res(); await handler(req('POST', freshIP()), r);
        assert.deepStrictEqual(r.body, { total: 100, today: 1 });
    });

    await test('POST blocks 6th request within a minute (in-memory)', async () => {
        const ip = freshIP();
        for (let i = 0; i < 5; i++) {
            const r = res(); await handler(req('POST', ip), r);
            assert.strictEqual(r.statusCode, 200, 'request ' + i + ' should pass');
        }
        const r = res(); await handler(req('POST', ip), r);
        assert.strictEqual(r.statusCode, 429);
        assert.strictEqual(r.hdrs['Retry-After'], '60');
    });

    await test('POST is capped at 20 per IP per day (persistent)', async () => {
        const ip = freshIP();
        store.set('ratelimit.json', JSON.stringify({ date: today(), ips: { [ipKey(ip)]: 18 } }));
        const a = res(); await handler(req('POST', ip), a);
        const b = res(); await handler(req('POST', ip), b);
        const c = res(); await handler(req('POST', ip), c);
        assert.deepStrictEqual(a.body, { total: 1, today: 1 });
        assert.deepStrictEqual(b.body, { total: 2, today: 2 });
        assert.strictEqual(c.hdrs['X-Counted'], '0');
        assert.deepStrictEqual(c.body, { total: 2, today: 2 });
    });

    await test('POST daily budget resets when the stored date is stale', async () => {
        const ip = freshIP();
        store.set('ratelimit.json', JSON.stringify({ date: '2000-01-01', ips: { [ipKey(ip)]: 999 } }));
        const r = res(); await handler(req('POST', ip), r);
        assert.strictEqual(r.hdrs['X-Counted'], '1');
    });

    await test('POST rate limit stores hashed IPs only', async () => {
        const ip = freshIP();
        await handler(req('POST', ip), res());
        const raw = store.get('ratelimit.json');
        assert.ok(raw && !raw.includes(ip), 'raw IP must not be persisted');
    });

    console.log('\n--- misc ---');

    await test('OPTIONS returns 204', async () => {
        const r = res(); await handler({ method: 'OPTIONS', headers: {} }, r);
        assert.strictEqual(r.statusCode, 204);
    });

    await test('PUT is rejected with 405', async () => {
        const r = res(); await handler(req('PUT', freshIP()), r);
        assert.strictEqual(r.statusCode, 405);
    });

    console.log(`\n=== Results: ${P}/${T} passed, ${F} failed ===\n`);
    if (F > 0) process.exit(1);
})();
