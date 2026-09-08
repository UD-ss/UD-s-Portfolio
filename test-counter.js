const assert = require('assert');
const Module = require('module');
const path = require('path');

const originalResolve = Module._resolveFilename;
const mockBlobPath = path.resolve(__dirname, 'test-mock-blob.js');

Module._resolveFilename = function(request) {
    if (request === '@vercel/blob') return mockBlobPath;
    return originalResolve.apply(this, arguments);
};

global.fetch = async function(url) {
    if (url && url.startsWith('mock://')) {
        const key = url.replace('mock://', '');
        const data = require('./test-mock-blob.js')._getStore()[key];
        if (data) return { ok: true, json: async () => JSON.parse(data) };
        return { ok: false };
    }
    return { ok: false };
};

const handler = require('./api/counter.js');
Module._resolveFilename = originalResolve;

let ipCounter = 0;
function freshIP() { return `10.0.0.${++ipCounter}`; }

function req(method) {
    return { method, headers: { 'x-forwarded-for': freshIP() } };
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

(async () => {
    console.log('\n=== Counter API Tests ===\n');

    // --- GET ---
    console.log('--- GET ---');

    await test('GET empty store → 0,0', async () => {
        const r = res(); await handler(req('GET'), r);
        assert.deepStrictEqual(r.body, { total: 0, today: 0 });
        assert.strictEqual(r.statusCode, 200);
    });

    await test('GET returns stored values', async () => {
        const dk = new Date().toISOString().slice(0, 10);
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 42, today: 5, date: dk }) });
        const r = res(); await handler(req('GET'), r);
        assert.deepStrictEqual(r.body, { total: 42, today: 5 });
    });

    await test('GET resets today if date differs', async () => {
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 42, today: 5, date: '2020-01-01' }) });
        const r = res(); await handler(req('GET'), r);
        assert.strictEqual(r.body.total, 42);
        assert.strictEqual(r.body.today, 0);
    });

    await test('GET preserves today if same date', async () => {
        const dk = new Date().toISOString().slice(0, 10);
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 10, today: 3, date: dk }) });
        const r = res(); await handler(req('GET'), r);
        assert.deepStrictEqual(r.body, { total: 10, today: 3 });
    });

    // --- POST ---
    console.log('\n--- POST ---');

    await test('POST creates → 1,1', async () => {
        const r = res(); await handler(req('POST'), r);
        assert.deepStrictEqual(r.body, { total: 1, today: 1 });
        const s = JSON.parse(require('./test-mock-blob.js')._getStore()['counter.json']);
        assert.strictEqual(s.total, 1);
        assert.strictEqual(s.today, 1);
        assert.strictEqual(s.date, new Date().toISOString().slice(0, 10));
    });

    await test('POST increments same day', async () => {
        const dk = new Date().toISOString().slice(0, 10);
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 10, today: 3, date: dk }) });
        const r = res(); await handler(req('POST'), r);
        assert.deepStrictEqual(r.body, { total: 11, today: 4 });
    });

    await test('POST resets today on new day', async () => {
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 10, today: 3, date: '2020-01-01' }) });
        const r = res(); await handler(req('POST'), r);
        assert.deepStrictEqual(r.body, { total: 11, today: 1 });
    });

    await test('POST→GET consistency', async () => {
        const p = res(); await handler(req('POST'), p);
        const g = res(); await handler(req('GET'), g);
        assert.deepStrictEqual(g.body, p.body);
    });

    await test('10 sequential POSTs → total 10', async () => {
        for (let i = 0; i < 10; i++) {
            await handler(req('POST'), res());
        }
        const r = res(); await handler(req('GET'), r);
        assert.strictEqual(r.body.total, 10);
        assert.strictEqual(r.body.today, 10);
    });

    // --- HTTP Methods ---
    console.log('\n--- HTTP Methods ---');

    await test('OPTIONS → 204', async () => {
        const r = res(); await handler(req('OPTIONS'), r);
        assert.strictEqual(r.statusCode, 204);
    });

    await test('PUT → 405', async () => {
        const r = res(); await handler(req('PUT'), r);
        assert.strictEqual(r.statusCode, 405);
    });

    await test('DELETE → 405', async () => {
        const r = res(); await handler(req('DELETE'), r);
        assert.strictEqual(r.statusCode, 405);
    });

    // --- Race Condition ---
    console.log('\n--- Race Condition ---');

    await test('10 concurrent POSTs → total 10', async () => {
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 0, today: 0, date: new Date().toISOString().slice(0, 10) }) });
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push((async () => {
                const r = res(); await handler(req('POST'), r); return r.body;
            })());
        }
        await Promise.all(promises);
        const stored = JSON.parse(require('./test-mock-blob.js')._getStore()['counter.json']);
        console.log(`    Expected: 10, Actual: ${stored.total}`);
        if (stored.total !== 10) console.log(`    ⚠ RACE CONDITION: ${10 - stored.total} increments lost`);
        assert.strictEqual(stored.total, 10);
    });

    // --- Edge Cases ---
    console.log('\n--- Edge Cases ---');

    await test('GET corrupt JSON → 0,0', async () => {
        require('./test-mock-blob.js')._set({ 'counter.json': 'CORRUPT{{' });
        const r = res(); await handler(req('GET'), r);
        assert.deepStrictEqual(r.body, { total: 0, today: 0 });
    });

    await test('POST corrupt JSON → fresh 1,1', async () => {
        require('./test-mock-blob.js')._set({ 'counter.json': 'CORRUPT' });
        const r = res(); await handler(req('POST'), r);
        assert.deepStrictEqual(r.body, { total: 1, today: 1 });
    });

    await test('POST null total/today → 1,1', async () => {
        const dk = new Date().toISOString().slice(0, 10);
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: null, today: null, date: dk }) });
        const r = res(); await handler(req('POST'), r);
        assert.deepStrictEqual(r.body, { total: 1, today: 1 });
    });

    await test('POST missing total → 1,1', async () => {
        const dk = new Date().toISOString().slice(0, 10);
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ date: dk }) });
        const r = res(); await handler(req('POST'), r);
        assert.deepStrictEqual(r.body, { total: 1, today: 1 });
    });

    await test('POST missing date → today resets', async () => {
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 5, today: 3 }) });
        const r = res(); await handler(req('POST'), r);
        assert.deepStrictEqual(r.body, { total: 6, today: 1 });
    });

    await test('GET missing total → 0', async () => {
        const dk = new Date().toISOString().slice(0, 10);
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ date: dk }) });
        const r = res(); await handler(req('GET'), r);
        assert.deepStrictEqual(r.body, { total: 0, today: 0 });
    });

    await test('GET missing date → today resets', async () => {
        require('./test-mock-blob.js')._set({ 'counter.json': JSON.stringify({ total: 5, today: 3 }) });
        const r = res(); await handler(req('GET'), r);
        assert.deepStrictEqual(r.body, { total: 5, today: 0 });
    });

    // --- CORS ---
    console.log('\n--- CORS ---');

    await test('GET/POST/OPTIONS set CORS header', async () => {
        for (const m of ['GET', 'POST', 'OPTIONS']) {
            const r = res(); await handler(req(m), r);
            assert.strictEqual(r.hdrs['Access-Control-Allow-Origin'], 'https://portfolio.ud-ss.me');
        }
    });

    console.log(`\n=== Results: ${P}/${T} passed, ${F} failed ===\n`);
    if (F > 0) process.exit(1);
})();
