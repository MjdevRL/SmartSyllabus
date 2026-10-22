// Supabase's free plan pauses a project after about a week with no activity.
// Vercel calls this twice a week (see vercel.json) so the sign-in keeps working.
export default {
  async fetch() {
    const { SUPABASE_URL, SUPABASE_ANON_KEY: key } = process.env;
    if (!SUPABASE_URL || !key) return new Response('Sign-in is not set up; nothing to do.');
    const url = SUPABASE_URL.trim().replace(/\/+$/, '');
    const headers = { apikey: key };
    const health = await fetch(`${url}/auth/v1/health`, { headers });
    await fetch(`${url}/rest/v1/`, { headers }).catch(() => {}); // also touches the database API
    return new Response(health.ok ? 'Supabase is awake.' : `Supabase answered ${health.status}.`, { status: health.ok ? 200 : 502 });
  },
};
