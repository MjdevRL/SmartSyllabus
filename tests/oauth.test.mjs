import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../lib/oauth.js';
import authFn from '../api/auth.js';
import callbackFn from '../api/callback.js';

const env = { GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'secret' };
const S = 'https://my-site.vercel.app';

test('refuses to run without settings', async () => {
  const r = await handle(new Request(S + '/api/auth'), {});
  assert.equal(r.status, 500);
  assert.match(await r.text(), /GITHUB_CLIENT_ID/);
});

test('/api/auth redirects to GitHub with a state cookie and this site as the return address', async () => {
  const r = await handle(new Request(S + '/api/auth?provider=github&site_id=my-site.vercel.app&scope=repo'), env);
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(loc.searchParams.get('client_id'), 'cid');
  assert.equal(loc.searchParams.get('redirect_uri'), S + '/api/callback');
  assert.equal(loc.searchParams.get('scope'), 'public_repo,read:user');
  const state = loc.searchParams.get('state');
  assert.match(r.headers.get('set-cookie'), new RegExp(`ss_oauth_state=${state};.*HttpOnly; Secure`));
  assert.ok(!loc.toString().includes('secret'), 'secret never leaves the server');
});

test('GITHUB_SCOPE can be changed for a private repository', async () => {
  const r = await handle(new Request(S + '/api/auth'), { ...env, GITHUB_SCOPE: 'repo,read:user' });
  assert.equal(new URL(r.headers.get('location')).searchParams.get('scope'), 'repo,read:user');
});

test('a trailing slash on the address still works', async () => {
  assert.equal((await handle(new Request(S + '/api/auth/'), env)).status, 302);
});

test('/api/callback rejects a mismatched state (CSRF protection)', async () => {
  const r = await handle(new Request(S + '/api/callback?code=abc&state=evil', { headers: { cookie: 'ss_oauth_state=good' } }), env);
  const html = await r.text();
  assert.match(html, /authorization:github:error/);
  assert.ok(!html.includes('access_token'));
});

test('/api/callback exchanges the code and only posts the token to this same site', async () => {
  const realFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (u, init) => { sent = { u, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ access_token: 'gho_TEST</script>' }), { headers: { 'content-type': 'application/json' } }); };
  try {
    const r = await handle(new Request(S + '/api/callback?code=abc&state=s1', { headers: { cookie: 'x=1; ss_oauth_state=s1' } }), env);
    const html = await r.text();
    assert.equal(sent.u, 'https://github.com/login/oauth/access_token');
    assert.deepEqual([sent.body.client_id, sent.body.client_secret, sent.body.code], ['cid', 'secret', 'abc']);
    assert.match(html, /authorization:github:success/);
    assert.match(html, /var origin="https:\/\/my-site\.vercel\.app"/);
    assert.ok(!html.includes('"*"'), 'never posts to any origin');
    assert.ok(!html.includes('</script>"'), 'token text is escaped inside the script');
    assert.ok(!html.includes('secret'), 'client secret is not in the page');
  } finally { globalThis.fetch = realFetch; }
});

test('/api/callback reports GitHub errors', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' }));
  try {
    const r = await handle(new Request(S + '/api/callback?code=abc&state=s1', { headers: { cookie: 'ss_oauth_state=s1' } }), env);
    assert.match(await r.text(), /incorrect or expired/);
  } finally { globalThis.fetch = realFetch; }
});

test('the two Vercel function files are wired to the handler', async () => {
  Object.assign(process.env, env);
  assert.equal((await authFn.fetch(new Request(S + '/api/auth'))).status, 302);
  assert.match(await (await callbackFn.fetch(new Request(S + '/api/callback?code=a&state=b'))).text(), /authorization:github:error/);
});

test('keepalive pings Supabase and reports failures', async () => {
  const { default: keep } = await import('../api/keepalive.js');
  const realFetch = globalThis.fetch; const calls = [];
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
    assert.equal((await keep.fetch()).status, 200); // not configured: harmless
    Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_ANON_KEY: 'k' });
    globalThis.fetch = async (u, init) => { calls.push([u, init.headers.apikey]); return new Response('', { status: 200 }); };
    assert.equal((await keep.fetch()).status, 200);
    assert.deepEqual(calls[0], ['https://x.supabase.co/auth/v1/health', 'k']);
    globalThis.fetch = async () => new Response('', { status: 503 });
    assert.equal((await keep.fetch()).status, 502);
  } finally { globalThis.fetch = realFetch; }
});
