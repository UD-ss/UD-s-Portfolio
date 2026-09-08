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
        if (data !== undefined) return { ok: true, json: async () => JSON.parse(data.toString()) };
        return { ok: false, status: 404 };
    }
    return { ok: false, status: 404 };
};

const handler = require('./api/upload.js');
Module._resolveFilename = originalResolve;

const TOKEN = 'a'.repeat(64);
const SESSION_KEY = 'sessions/' + TOKEN + '.json';

function res() {
    let status = 200;
    let body = null;
    let ended = false;
    const headers = {};
    const result = {
        setHeader: (key, value) => { headers[key] = value; },
        status: code => { status = code; return result; },
        json: data => { body = data; ended = true; return result; },
        end: () => { ended = true; },
        get statusCode() { return status; },
        get body() { return body; },
        get ended() { return ended; },
        get hdrs() { return headers; }
    };
    return result;
}

function request(body, filename, extension, token) {
    const boundary = '----upload-test-boundary';
    const header = Buffer.from(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n' +
        'Content-Type: image/' + extension + '\r\n\r\n',
        'binary'
    );
    const footer = Buffer.from('\r\n--' + boundary + '--\r\n', 'binary');
    const payload = Buffer.concat([header, body, footer]);
    const chunks = [payload.subarray(0, Math.ceil(payload.length / 2)), payload.subarray(Math.ceil(payload.length / 2))];
    return {
        method: 'POST',
        headers: {
            authorization: token === undefined ? 'Bearer ' + TOKEN : (token ? 'Bearer ' + token : ''),
            'content-type': 'multipart/form-data; boundary=' + boundary,
            'content-length': String(payload.length)
        },
        on(event, callback) {
            if (event === 'data') chunks.forEach(chunk => setImmediate(() => callback(chunk)));
            if (event === 'end') setImmediate(callback);
            return this;
        }
    };
}

function session(expiresAt) {
    return JSON.stringify({ token: TOKEN, createdAt: Date.now(), expiresAt: expiresAt || Date.now() + 86400000 });
}

function pngBytes() { return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]); }
function jpegBytes() { return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); }
function webpBytes() { return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]); }
function gifBytes() { return Buffer.from('GIF89a-data', 'ascii'); }
function withSession(expiresAt) { mockBlob._set({ [SESSION_KEY]: session(expiresAt) }); }

let passed = 0;
let failed = 0;
async function test(name, fn) {
    mockBlob._reset();
    try {
        await fn();
        passed++;
        console.log('  ✓ ' + name);
    } catch (error) {
        failed++;
        console.log('  ✗ ' + name);
        console.log('    ' + error.message);
    }
}

(async () => {
    console.log('\n=== Upload API Tests ===\n');

    await test('OPTIONS → 204', async () => {
        const r = res();
        await handler({ method: 'OPTIONS', headers: {} }, r);
        assert.strictEqual(r.statusCode, 204);
    });

    await test('POST without session → 401', async () => {
        const r = res();
        await handler(request(pngBytes(), 'image.png'), r);
        assert.strictEqual(r.statusCode, 401);
    });

    await test('Expired session → 401', async () => {
        withSession(Date.now() - 1);
        const r = res();
        await handler(request(pngBytes(), 'image.png'), r);
        assert.strictEqual(r.statusCode, 401);
    });

    await test('Non-multipart request → 400', async () => {
        withSession();
        const r = res();
        await handler({ method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' } }, r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('Valid PNG magic bytes → 200', async () => {
        withSession();
        const r = res();
        await handler(request(pngBytes(), 'image.png', 'png'), r);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.body.ok, true);
        assert(r.body.url.startsWith('mock://projects/'));
        const keys = Object.keys(mockBlob._getStore()).filter(key => key.startsWith('projects/'));
        assert.strictEqual(keys.length, 1);
        assert(Buffer.isBuffer(mockBlob._getStore()[keys[0]]));
    });

    await test('Valid JPEG magic bytes with jpeg extension → 200', async () => {
        withSession();
        const r = res();
        await handler(request(jpegBytes(), 'photo.jpeg', 'jpeg'), r);
        assert.strictEqual(r.statusCode, 200);
    });

    await test('Valid WebP magic bytes → 200', async () => {
        withSession();
        const r = res();
        await handler(request(webpBytes(), 'image.webp', 'webp'), r);
        assert.strictEqual(r.statusCode, 200);
    });

    await test('Valid GIF magic bytes → 200', async () => {
        withSession();
        const r = res();
        await handler(request(gifBytes(), 'image.gif', 'gif'), r);
        assert.strictEqual(r.statusCode, 200);
    });

    await test('HTML disguised as PNG → 400', async () => {
        withSession();
        const r = res();
        await handler(request(Buffer.from('<script>alert(1)</script>'), 'image.png', 'png'), r);
        assert.strictEqual(r.statusCode, 400);
        assert.strictEqual(Object.keys(mockBlob._getStore()).filter(key => key.startsWith('projects/')).length, 0);
    });

    await test('PNG content with JPG extension → 400', async () => {
        withSession();
        const r = res();
        await handler(request(pngBytes(), 'image.jpg', 'jpg'), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('Invalid extension → 400', async () => {
        withSession();
        const r = res();
        await handler(request(pngBytes(), 'image.exe', 'exe'), r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('Content-Length above 10MB → 413', async () => {
        withSession();
        const r = res();
        const req = request(pngBytes(), 'image.png');
        req.headers['content-length'] = String(10 * 1024 * 1024 + 1);
        await handler(req, r);
        assert.strictEqual(r.statusCode, 413);
    });

    await test('Stream body above 10MB → 400', async () => {
        withSession();
        const r = res();
        const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
        const req = request(oversized, 'image.png');
        req.headers['content-length'] = '0';
        await handler(req, r);
        assert.strictEqual(r.statusCode, 400);
    });

    await test('Two uploads receive different object names', async () => {
        withSession();
        const first = res();
        await handler(request(pngBytes(), 'same.png'), first);
        const second = res();
        await handler(request(pngBytes(), '../same.png'), second);
        assert.strictEqual(first.statusCode, 200);
        assert.strictEqual(second.statusCode, 200);
        assert.notStrictEqual(first.body.url, second.body.url);
    });

    console.log('\n=== Results: ' + passed + '/' + (passed + failed) + ' passed, ' + failed + ' failed ===\n');
    if (failed) process.exit(1);
})();
