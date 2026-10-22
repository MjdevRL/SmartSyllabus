// Visitor sign-in (Supabase) and the "Admin mode" button.
// The page works without this file's UI: if assets/config.js has no Supabase settings, nothing is shown.
import cfg from './config.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const enabled = Boolean(cfg.url && cfg.key);
let client;

export { cfg };

/** The Supabase client (created once), or null when sign-in is not configured. */
export function getClient() {
  if (!enabled) return null;
  client ||= import(SDK).then((m) => m.createClient(cfg.url, cfg.key));
  return client;
}

/** True only if the signed-in email is in the database's admins table (see supabase/setup.sql). */
export async function checkAdmin(sb) {
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function makeDialog(sb) {
  const d = h('dialog', 'dlg');
  d.innerHTML = `<div class="dlg-body">
    <h2>Sign in</h2>
    <p class="dim">Create an account or sign in. No password needed.</p>
    <button type="button" class="btn" data-g>Continue with Google</button>
    <p class="dlg-or dim">or use your email</p>
    <form data-f>
      <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email address">
      <button class="btn primary" type="submit">Email me a sign-in link</button>
    </form>
    <p class="dlg-msg" role="status" aria-live="polite"></p>
    <button type="button" class="btn ghost sm" data-x>Close</button>
  </div>`;
  const msg = d.querySelector('.dlg-msg');
  const back = location.href.split('#')[0];
  const say = (t, bad) => { msg.textContent = t; msg.className = 'dlg-msg' + (bad ? ' bad' : ''); };
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  d.querySelector('[data-g]').addEventListener('click', async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back } });
    if (error) say(error.message, true);
  });
  d.querySelector('[data-f]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; say('Sending…');
    const { error } = await sb.auth.signInWithOtp({ email: e.target.email.value.trim(), options: { emailRedirectTo: back } });
    btn.disabled = false;
    if (error) say(error.message, true); else say('Check your inbox for the sign-in link.');
  });
  document.body.append(d);
  return d;
}

async function init(slot) {
  const sb = await getClient();
  const dlg = makeDialog(sb);
  const adminUrl = new URL('../admin/', import.meta.url).href;
  const render = async (session) => {
    const next = [];
    if (!session) {
      const b = h('button', 'btn sm primary', 'Sign in'); b.type = 'button'; b.addEventListener('click', () => dlg.showModal());
      next.push(b);
    } else {
      dlg.close();
      if (await checkAdmin(sb)) { const a = h('a', 'btn sm primary', 'Admin mode'); a.href = adminUrl; next.push(a); }
      const o = h('button', 'btn sm', 'Sign out'); o.type = 'button'; o.title = session.user.email || '';
      o.addEventListener('click', () => sb.auth.signOut());
      next.push(o);
    }
    slot.replaceChildren(...next); slot.hidden = false;
  };
  // Run later, not inside the callback: Supabase warns against calling it from within.
  sb.auth.onAuthStateChange((_event, session) => setTimeout(() => render(session), 0));
}

const slot = document.getElementById('auth');
if (slot && enabled) init(slot).catch(() => { slot.hidden = true; });
