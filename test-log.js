const assert = require('assert');

let webhookCalls = [];

global.fetch = async function(url, opts) {
    if (url === 'https://script.google.com/test-webhook') {
        webhookCalls.push({ url, opts });
        return { ok: true, status: 200 };
    }
    if (url === 'https://script.google.com/fail-webhook') {
        return { ok: false, status: 500 };
    }
    return { ok: false, status: 404 };
};

process.env.SHEETS_WEBHOOK_URL = 'https://script.google.com/test-webhook';

const handler = require('./api/log.js');

let ipCounter = 0;
function freshIP() { return `10.0.0.${++ipCounter}`; }

function req(method, body, ip, ua) {
    const r = {
        method,
        headers: {
            'x-forwarded-for': ip || freshIP(),
            'user-agent': ua || 'TestAgent/1.0'
        },
        connection: { remoteAddress: '127.0.0.1' }
    };
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
        webhookCalls = [];
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
    console.log('\n=== Log API Tests ===\n');

    console.log('--- Basic Logging ---');

    await test('POST visit log → 200 + webhook called', async () => {
        const r = res();
        await handler(req('POST', { type: 'visit', data: { theme: 'dark' } }), r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.ok, true);
        assert.strictEqual(webhookCalls.length, 1);
    });

    await test('Webhook receives log data', async () => {
        const r = res();
        await handler(req('POST', { type: 'visit', data: { theme: 'dark' } }), r);
        const webhookBody = JSON.parse(webhookCalls[0].opts.body);
        assert.strictEqual(webhookBody.type, 'visit');
        assert.strictEqual(webhookBody.data.theme, 'dark');
    });

    await test('Webhook receives IP and userAgent', async () => {
        const ip = freshIP();
        const r = res();
        await handler(req('POST', { type: 'visit' }, ip, 'Mozilla/5.0'), r);
        const webhookBody = JSON.parse(webhookCalls[0].opts.body);
        assert.strictEqual(webhookBody.ip, ip);
        assert.strictEqual(webhookBody.userAgent, 'Mozilla/5.0');
    });

    await test('Webhook receives receivedAt timestamp', async () => {
        const r = res();
        await handler(req('POST', { type: 'visit' }), r);
        const webhookBody = JSON.parse(webhookCalls[0].opts.body);
        assert(typeof webhookBody.receivedAt === 'string');
        assert(!isNaN(Date.parse(webhookBody.receivedAt)));
    });

    await test('Theme change log', async () => {
        const r = res();
        await handler(req('POST', { type: 'theme', data: { from: 'light', to: 'dark' } }), r);
        assert.strictEqual(r.statusCode, 200);
        const webhookBody = JSON.parse(webhookCalls[0].opts.body);
        assert.strictEqual(webhookBody.type, 'theme');
        assert.strictEqual(webhookBody.data.from, 'light');
        assert.strictEqual(webhookBody.data.to, 'dark');
    });

    console.log('\n--- HTTP Methods ---');

    await test('OPTIONS → 204', async () => {
        const r = res(); await handler(req('OPTIONS'), r);
        assert.strictEqual(r.statusCode, 204);
        assert.strictEqual(webhookCalls.length, 0);
    });

    await test('GET → 405', async () => {
        const r = res(); await handler(req('GET'), r);
        assert.strictEqual(r.statusCode, 405);
        assert.strictEqual(webhookCalls.length, 0);
    });

    await test('PUT → 405', async () => {
        const r = res(); await handler(req('PUT'), r);
        assert.strictEqual(r.statusCode, 405);
    });

    console.log('\n--- Rate Limiting ---');

    await test('30 requests from same IP → all processed', async () => {
        const ip = freshIP();
        for (let i = 0; i < 30; i++) {
            const r = res();
            await handler(req('POST', { type: 'test' }, ip), r);
            assert(r.statusCode === 200, `Request ${i+1} should succeed, got ${r.statusCode}`);
        }
    });

    await test('31st request from same IP → 429', async () => {
        const ip = freshIP();
        for (let i = 0; i < 30; i++) {
            const r = res();
            await handler(req('POST', { type: 'test' }, ip), r);
        }
        const r = res();
        await handler(req('POST', { type: 'test' }, ip), r);
        assert.strictEqual(r.statusCode, 429);
    });

    await test('Different IP is not rate limited', async () => {
        const ip1 = freshIP();
        for (let i = 0; i < 30; i++) {
            const r = res();
            await handler(req('POST', { type: 'test' }, ip1), r);
        }
        const r = res();
        await handler(req('POST', { type: 'test' }, freshIP()), r);
        assert.strictEqual(r.statusCode, 200);
    });

    console.log('\n--- Error Handling ---');

    await test('Webhook failure → 502', async () => {
        const origUrl = process.env.SHEETS_WEBHOOK_URL;
        process.env.SHEETS_WEBHOOK_URL = 'https://script.google.com/fail-webhook';
        const r = res();
        await handler(req('POST', { type: 'visit' }), r);
        assert.strictEqual(r.statusCode, 502);
        assert.strictEqual(r.body.ok, false);
        process.env.SHEETS_WEBHOOK_URL = origUrl;
    });

    await test('Missing SHEETS_WEBHOOK_URL → 500', async () => {
        const orig = process.env.SHEETS_WEBHOOK_URL;
        delete process.env.SHEETS_WEBHOOK_URL;
        const r = res();
        await handler(req('POST', { type: 'visit' }), r);
        assert.strictEqual(r.statusCode, 500);
        process.env.SHEETS_WEBHOOK_URL = orig;
    });

    await test('Empty body → still processes (no crash)', async () => {
        const r = res();
        await handler(req('POST', {}), r);
        assert.strictEqual(r.statusCode, 200);
    });

    await test('String body (JSON) → parsed correctly', async () => {
        const r = res();
        await handler(req('POST', JSON.stringify({ type: 'visit' })), r);
        assert.strictEqual(r.statusCode, 200);
        const webhookBody = JSON.parse(webhookCalls[0].opts.body);
        assert.strictEqual(webhookBody.type, 'visit');
    });

    await test('Invalid JSON string body → no crash', async () => {
        const r = res();
        const reqObj = req('POST');
        reqObj.body = 'NOT VALID JSON{{{';
        await handler(reqObj, r);
        assert.strictEqual(r.statusCode, 200);
    });

    console.log('\n--- CORS ---');

    await test('CORS headers set correctly', async () => {
        const r = res(); await handler(req('OPTIONS'), r);
        assert.strictEqual(r.hdrs['Access-Control-Allow-Origin'], 'https://portfolio.ud-ss.me');
        assert(r.hdrs['Access-Control-Allow-Methods'].includes('POST'));
    });

    console.log('\n--- IP Extraction ---');

    await test('x-forwarded-for with single IP', async () => {
        const r = res();
        await handler(req('POST', { type: 'test' }, '1.2.3.4'), r);
        const webhookBody = JSON.parse(webhookCalls[0].opts.body);
        assert.strictEqual(webhookBody.ip, '1.2.3.4');
    });

    await test('x-forwarded-for with multiple IPs (takes first)', async () => {
        const ip = '1.2.3.4, 5.6.7.8, 9.10.11.12';
        const r = res();
        const reqObj = req('POST', { type: 'test' });
        reqObj.headers['x-forwarded-for'] = ip;
        await handler(reqObj, r);
        const webhookBody = JSON.parse(webhookCalls[0].opts.body);
        assert.strictEqual(webhookBody.ip, '1.2.3.4');
    });

    console.log(`\n=== Results: ${P}/${T} passed, ${F} failed ===\n`);
    if (F > 0) process.exit(1);
})();
