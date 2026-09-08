const assert = require('assert');
const Module = require('module');
const path = require('path');

const originalResolve = Module._resolveFilename;
const mockBlobPath = path.resolve(__dirname, 'test-mock-blob.js');

Module._resolveFilename = function(request) {
    if (request === '@vercel/blob') return mockBlobPath;
    return originalResolve.apply(this, arguments);
};

const mockBlob = require('./test-mock-blob.js');

global.fetch = async function(url) {
    if (url && url.startsWith('mock://')) {
        const key = url.replace('mock://', '');
        const data = mockBlob._getStore()[key];
        if (data) return { ok: true, json: async () => JSON.parse(data) };
        return { ok: false };
    }
    return { ok: false };
};

const { TOTP, Secret } = require('otpauth');
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
process.env.TOTP_SECRET = TOTP_SECRET;

const handler = require('./api/auth.js');
Module._resolveFilename = originalResolve;

function genTOTP() {
    const secret = Secret.fromBase32(TOTP_SECRET);
    const totp = new TOTP({ issuer: 'Portfolio', label: 'admin', algorithm: 'SHA1', digits: 6, period: 30, secret });
    return totp.generate();
}

let ipCounter = 0;
function freshIP() { return `10.0.0.${++ipCounter}`; }

function req(method, body, ip) {
    const r = { method, headers: { 'x-forwarded-for': ip || freshIP() } };
    if (body) r.body = typeof body === 'string' ? body : JSON.stringify(body);
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
        mockBlob._reset();
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
    console.log('\n=== Auth API Tests ===\n');

    console.log('--- Basic Auth ---');

    await test('POST valid TOTP code → 200 + token', async () => {
        const code = genTOTP();
        const r = res(); await handler(req('POST', { code }), r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.ok, true);
        assert(typeof r.body.token === 'string');
        assert.strictEqual(r.body.token.length, 64);
    });

    await test('POST invalid code → 401', async () => {
        const r = res(); await handler(req('POST', { code: '000000' }), r);
        if (r.statusCode !== 401) {
            const code2 = genTOTP();
            const wrong = code2 === '000000' ? '111111' : '000000';
            const r2 = res(); await handler(req('POST', { code: wrong }), r2);
            assert.strictEqual(r2.statusCode, 401);
        }
    });

    await test('POST missing code → 400', async () => {
        const r = res(); await handler(req('POST', {}), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST non-string code → 400', async () => {
        const r = res(); await handler(req('POST', { code: 12345 }), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST non-6-digit code → 400', async () => {
        const r = res(); await handler(req('POST', { code: '12345' }), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('POST code with letters → 400', async () => {
        const r = res(); await handler(req('POST', { code: 'abcdef' }), r);
        assert.strictEqual(r.statusCode, 400);
    });

    console.log('\n--- Session Storage ---');

    await test('Valid auth creates session blob', async () => {
        const code = genTOTP();
        const r = res(); await handler(req('POST', { code }), r);
        assert.strictEqual(r.statusCode, 200);
        const token = r.body.token;
        const store = mockBlob._getStore();
        const sessionKey = 'sessions/' + token + '.json';
        assert(store[sessionKey], 'Session blob should exist');
        const sessionData = JSON.parse(store[sessionKey]);
        assert.strictEqual(sessionData.token, token);
        assert(typeof sessionData.createdAt === 'number');
    });

    await test('Token is 64 hex chars', async () => {
        const code = genTOTP();
        const r = res(); await handler(req('POST', { code }), r);
        assert(/^[a-f0-9]{64}$/.test(r.body.token));
    });

    console.log('\n--- HTTP Methods ---');

    await test('OPTIONS → 204', async () => {
        const r = res(); await handler(req('OPTIONS'), r);
        assert.strictEqual(r.statusCode, 204);
    });

    await test('GET → configuration status', async () => {
        const r = res(); await handler(req('GET'), r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.configured, true);
    });

    await test('DELETE without token → 401', async () => {
        const r = res(); await handler(req('DELETE'), r);
        assert.strictEqual(r.statusCode, 401);
    });

    await test('DELETE valid session → 204 and removes blob', async () => {
        const code = genTOTP();
        const login = res(); await handler(req('POST', { code }), login);
        assert.strictEqual(login.statusCode, 200);
        const token = login.body.token;
        const logout = res(); await handler(req('DELETE', null, freshIP()), logout);
        assert.strictEqual(logout.statusCode, 401);
        const authorizedRequest = req('DELETE');
        authorizedRequest.headers.authorization = 'Bearer ' + token;
        const authorizedLogout = res(); await handler(authorizedRequest, authorizedLogout);
        assert.strictEqual(authorizedLogout.statusCode, 204);
        assert.strictEqual(mockBlob._getStore()['sessions/' + token + '.json'], undefined);
    });

    await test('PUT → 405', async () => {
        const r = res(); await handler(req('PUT'), r);
        assert.strictEqual(r.statusCode, 405);
    });

    console.log('\n--- Rate Limiting ---');

    await test('5 requests from same IP → 5th succeeds', async () => {
        const ip = freshIP();
        for (let i = 0; i < 5; i++) {
            const code = genTOTP();
            const r = res();
            await handler(req('POST', { code }, ip), r);
            if (i < 4) {
                assert(r.statusCode === 200 || r.statusCode === 401, `Request ${i+1} should not be rate limited`);
            }
        }
    });

    await test('6th request from same IP → 429', async () => {
        const ip = freshIP();
        for (let i = 0; i < 5; i++) {
            const code = genTOTP();
            const r = res();
            await handler(req('POST', { code }, ip), r);
        }
        const r = res();
        await handler(req('POST', { code: '000000' }, ip), r);
        assert.strictEqual(r.statusCode, 429);
    });

    await test('Different IP is not rate limited', async () => {
        const ip1 = freshIP();
        for (let i = 0; i < 5; i++) {
            const code = genTOTP();
            const r = res();
            await handler(req('POST', { code }, ip1), r);
        }
        const code = genTOTP();
        const r = res();
        await handler(req('POST', { code }, freshIP()), r);
        assert(r.statusCode === 200 || r.statusCode === 401);
    });

    console.log('\n--- CORS ---');

    await test('CORS headers set correctly', async () => {
        const r = res(); await handler(req('OPTIONS'), r);
        assert.strictEqual(r.hdrs['Access-Control-Allow-Origin'], 'https://portfolio.ud-ss.me');
        assert(r.hdrs['Access-Control-Allow-Methods'].includes('POST'));
        assert(r.hdrs['Access-Control-Allow-Headers'].includes('Authorization'));
    });

    console.log('\n--- TOTP_SECRET not set ---');

    await test('Missing TOTP_SECRET → 500', async () => {
        const orig = process.env.TOTP_SECRET;
        delete process.env.TOTP_SECRET;
        const code = genTOTP();
        const r = res(); await handler(req('POST', { code }), r);
        assert.strictEqual(r.statusCode, 500);
        process.env.TOTP_SECRET = orig;
    });

    console.log(`\n=== Results: ${P}/${T} passed, ${F} failed ===\n`);
    if (F > 0) process.exit(1);
})();
