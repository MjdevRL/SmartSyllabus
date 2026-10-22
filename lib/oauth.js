// Editor sign-in for the dashboard: GitHub login, run as two Vercel functions (api/auth.js, api/callback.js).
// Lets the dashboard at /admin save pages to your GitHub repository. It needs a secret that must never be in the website's code.
//
// Settings in Vercel (Project → Settings → Environment Variables):
//   GITHUB_CLIENT_ID      from your GitHub OAuth app
//   GITHUB_CLIENT_SECRET  from your GitHub OAuth app
//   GITHUB_SCOPE          optional. Default "public_repo,read:user" (public repository). Use "repo,read:user" for a private one.
// The login only hands the token back to the site it is running on (same address as the dashboard).

const page = (body, status = 200, headers = {}) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>Smart Syllabus sign-in</title><body style="font-family:sans-serif;padding:30px">${body}</body>`, {
    status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const getCookie = (req, name) => {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
};

/** The little page that hands the login result back to the dashboard window, and only to your site. */
function handOff(status, content, origin) {
  const msg = `authorization:github:${status}:${JSON.stringify(content)}`;
  const script = `(function(){var origin=${JSON.stringify(origin)};var msg=${JSON.stringify(msg)};
function receive(e){if(e.origin!==origin)return;window.removeEventListener('message',receive);e.source.postMessage(msg,origin);setTimeout(function(){window.close()},300);}
window.addEventListener('message',receive);if(window.opener){window.opener.postMessage('authorizing:github',origin);}else{document.body.textContent='Please start the sign-in from the dashboard.';}})();`.replace(/</g, '\\u003c');
  return page(`<p>${status === 'success' ? 'Signed in. You can close this window.' : 'Sign-in failed. You can close this window and try again.'}</p><script>${script}</script>`, 200, {
    'set-cookie': 'ss_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
  });
}

export async function handle(req, env) {
  const url = new URL(req.url);
  const missing = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'].filter((k) => !env[k]);
  if (missing.length) return page(`<p>The sign-in helper isn't set up yet. Missing setting(s): ${missing.join(', ')}.</p>`, 500);
  const origin = url.origin;

  if (/\/auth\/?$/.test(url.pathname)) {
    if (url.searchParams.get('provider') && url.searchParams.get('provider') !== 'github') return page('<p>Only GitHub sign-in is supported.</p>', 400);
    const state = crypto.randomUUID();
    const gh = new URL('https://github.com/login/oauth/authorize');
    gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    gh.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
    gh.searchParams.set('scope', env.GITHUB_SCOPE || 'public_repo,read:user');
    gh.searchParams.set('state', state);
    return new Response(null, {
      status: 302,
      headers: { location: gh.toString(), 'set-cookie': `ss_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`, 'cache-control': 'no-store' },
    });
  }

  if (/\/callback\/?$/.test(url.pathname)) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expected = getCookie(req, 'ss_oauth_state');
    if (!code || !state || !expected || state !== expected) {
      return handOff('error', { message: 'The sign-in link expired or was not started from the dashboard. Please try again.' }, origin);
    }
    let data;
    try {
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'smart-syllabus-auth' },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/api/callback` }),
      });
      data = await r.json();
    } catch {
      return handOff('error', { message: 'Could not reach GitHub. Please try again.' }, origin);
    }
    if (!data.access_token) return handOff('error', { message: data.error_description || 'GitHub did not approve the sign-in.' }, origin);
    return handOff('success', { token: data.access_token, provider: 'github' }, origin);
  }

  return page('<p>This address is used by the editor sign-in. Open the site\'s <code>/admin/</code> page instead.</p>', 404);
}
