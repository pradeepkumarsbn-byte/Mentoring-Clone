import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bridgeRequest } from './connection.ts';

const url = 'https://script.google.com/macros/s/test-deployment/exec';
const temporaryUrl = 'https://script.googleusercontent.com/macros/echo?test=1';

test('Apps Script bridge response handling', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.MENTORING_SHEETS_TOKEN;
  process.env.MENTORING_SHEETS_TOKEN = 'test-private-token';
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.MENTORING_SHEETS_TOKEN;
    else process.env.MENTORING_SHEETS_TOKEN = originalToken;
  });

  await t.test('follows 302 with GET and keeps token on original POST only', async () => {
    const calls = [];
    globalThis.fetch = async (target, options) => {
      calls.push({ target, options });
      return calls.length === 1
        ? new Response(null, { status: 302, headers: { location: temporaryUrl } })
        : Response.json({ ok: true, mentors: [] });
    };
    assert.deepEqual(await bridgeRequest(url, { action: 'get_state' }), { ok: true, mentors: [] });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].target, url);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(JSON.parse(calls[0].options.body).token, 'test-private-token');
    assert.equal(calls[1].target, temporaryUrl);
    assert.equal(calls[1].options.method, 'GET');
    assert.equal(calls[1].options.body, undefined);
    assert.equal(calls[1].options.headers, undefined);
    assert.equal(calls[1].options.cache, undefined);
    assert.deepEqual(calls[1].options.next, { revalidate: 0 });
  });

  await t.test('does not wait for a stalled redirect-body cancellation', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      if (++calls === 1) return {
        status: 302, headers: new Headers({ location: temporaryUrl }),
        body: { cancel: () => new Promise(() => {}) },
      };
      return Response.json({ ok: true });
    };
    let timer;
    try {
      await Promise.race([
        bridgeRequest(url, { action: 'get_state' }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Redirect stalled')), 500); }),
      ]);
      assert.equal(calls, 2);
    } finally { clearTimeout(timer); }
  });

  for (const [name, response, expected] of [
    ['HTTP failure', () => new Response('failure', { status: 400 }), /HTTP 400/],
    ['backend error', () => Response.json({ ok: false, error: 'Spreadsheet not configured' }), /Spreadsheet not configured/],
    ['false without error', () => Response.json({ ok: false }), /spreadsheet request failed/],
    ['error without false', () => Response.json({ error: 'Backend failure' }), /Backend failure/],
    ['invalid JSON', () => new Response('<html>Error</html>'), /valid data/],
    ['null JSON', () => Response.json(null), /JSON object/],
    ['array JSON', () => Response.json([]), /JSON object/],
  ]) {
    await t.test(`rejects final ${name} after redirect`, async () => {
      let calls = 0;
      globalThis.fetch = async () => ++calls === 1
        ? new Response(null, { status: 302, headers: { location: temporaryUrl } })
        : response();
      await assert.rejects(bridgeRequest(url, { action: 'get_state' }), expected);
      assert.equal(calls, 2);
    });
  }

  await t.test('rejects untrusted redirect before sending another request', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: 'https://example.com/' } });
    };
    await assert.rejects(bridgeRequest(url, { action: 'get_state' }), /Deploy as a Web app/);
    assert.equal(calls, 1);
  });

  await t.test('never retries a write after a temporary HTTP error', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 503 }); };
    await assert.rejects(bridgeRequest(url, { action: 'update_boy' }), /HTTP 503/);
    assert.equal(calls, 1);
  });

  await t.test('coalesces simultaneous reads but does not cache completed reads', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ ok: true }); };
    await Promise.all([bridgeRequest(url, { action: 'get_state' }), bridgeRequest(url, { action: 'get_state' })]);
    assert.equal(calls, 1);
    await bridgeRequest(url, { action: 'get_state' });
    assert.equal(calls, 2);
  });
  await t.test('keeps access checks separate for different users', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ allowed: false }); };
    await Promise.all(['one@example.com', 'two@example.com'].map(email => bridgeRequest(url, { action: 'check_access', email })));
    assert.equal(calls, 2);
  });
  await t.test('recovers on the third read attempt', async () => {
    let calls = 0;
    globalThis.fetch = async () => ++calls < 3 ? new Response(null, { status: 503 }) : Response.json({ ok: true });
    assert.deepEqual(await bridgeRequest(url, { action: 'get_state' }), { ok: true });
    assert.equal(calls, 3);
  });
  await t.test('stops after three attempts and clears failed pending reads', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 503 }); };
    await assert.rejects(bridgeRequest(url, { action: 'get_state' }), /HTTP 503/);
    assert.equal(calls, 3);
    globalThis.fetch = async () => Response.json({ ok: true });
    assert.deepEqual(await bridgeRequest(url, { action: 'get_state' }), { ok: true });
  });

  for (const failure of [
    () => new Response(null, { status: 302, headers: { location: 'https://script.google.com/temporary-error' } }),
    () => new Response(null, { status: 404 }),
  ]) {
    await t.test('retries reads with a fresh URL after ContentService delivery fails', async () => {
      let calls = 0;
      globalThis.fetch = async (target) => {
        calls++;
        if (calls === 1 || calls === 3) {
          assert.equal(target, url);
          return new Response(null, { status: 302, headers: { location: temporaryUrl } });
        }
        assert.equal(target, temporaryUrl);
        return calls === 2 ? failure() : Response.json({ ok: true });
      };
      assert.deepEqual(await bridgeRequest(url, { action: 'get_state' }), { ok: true });
      assert.equal(calls, 4);
    });
    await t.test('does not replay writes after ContentService delivery fails', async () => {
      let calls = 0;
      globalThis.fetch = async () => ++calls === 1
        ? new Response(null, { status: 302, headers: { location: temporaryUrl } })
        : failure();
      await assert.rejects(bridgeRequest(url, { action: 'update_boy' }), /could not deliver/);
      assert.equal(calls, 2);
    });
  }
});
