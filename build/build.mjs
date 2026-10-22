// Builds the public website into dist/ from the content/ folder.
//   node build/build.mjs          -> full build
//   node build/build.mjs --check  -> check pages + record addresses (used by GitHub Actions before building)
// Environment: SITE_BASE ("/" or "/repo/"), SITE_URL, CMS_REPO, CMS_BRANCH, CMS_AUTH_URL, CMS_LOCAL=1.
//   On Vercel, SITE_URL and CMS_REPO are filled in automatically and the editor sign-in uses /api/auth;
//   set CMS_AUTH_URL only if you run the sign-in helper somewhere else,
//              SUPABASE_URL, SUPABASE_ANON_KEY (visitor sign-in; both public values, leave empty to switch sign-in off)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveSite, updateHistory, siteTree, ancestors, describePlacement } from './render/hierarchy.mjs';
import { renderPageSheet } from './render/page.mjs';
import { renderSidebar, renderLayout } from './render/layout.mjs';
import { renderBlocks } from './render/blocks.mjs';
import { renderUniversity, renderUniversityList, uniPath } from './render/universities.mjs';
import { esc, withBase, mediaUrl, webUrl, formatBytes } from './render/util.mjs';
import { md } from './render/markdown.mjs';
import { cmsConfig } from './cms-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = (...p) => path.join(ROOT, 'content', ...p);
const DIST = path.join(ROOT, 'dist');
const CHECK_ONLY = process.argv.includes('--check');
let BASE = process.env.SITE_BASE || '/';
if (!BASE.endsWith('/')) BASE += '/';
BASE = BASE.replace(/\/{2,}/g, '/');
const E = process.env;
const SITE_URL = (E.SITE_URL || (E.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + E.VERCEL_PROJECT_PRODUCTION_URL : '')).replace(/\/+$/, '');
const CMS_REPO = E.CMS_REPO || (E.VERCEL_GIT_REPO_OWNER && E.VERCEL_GIT_REPO_SLUG ? `${E.VERCEL_GIT_REPO_OWNER}/${E.VERCEL_GIT_REPO_SLUG}` : '');
const AUTH_URL = (E.CMS_AUTH_URL || (E.VERCEL ? SITE_URL : '')).trim().replace(/\/+$/, '');
const AUTH_ENDPOINT = E.CMS_AUTH_URL ? 'auth' : 'api/auth';

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { if (fs.existsSync(f)) throw new Error(`Couldn't read ${path.relative(ROOT, f)}: ${e.message}`); return fallback; } };
const readDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ ...readJson(path.join(dir, f), {}), id: f.replace(/\.json$/, '') })) : []);

// ---------- Load content ----------
const pages = readDir(C('pages'));
const noticesList = readDir(C('notices'));
const universities = readDir(C('universities')).filter((u) => u.status !== 'draft');
const site = { site_name: 'Smart Syllabus', show_universities: true, universities_label: 'Universities', feedback_label: 'Feedback', ...readJson(C('settings', 'site.json'), {}) };
const home = readJson(C('settings', 'home.json'), { heading: site.site_name });
const extraRedirects = readJson(C('settings', 'redirects.json'), { items: [] }).items || [];
const historyFile = C('system', 'url-history.json');
const history = readJson(historyFile, {});

const resolved = resolveSite(pages, { history, extraRedirects });
const warnings = new Set(resolved.warnings);
const warn = (w) => warnings.add(w);

// ---------- Report (console + GitHub Actions summary) ----------
function report(extra = []) {
  const lines = [];
  if (resolved.errors.length) {
    lines.push('## ❌ The website was NOT updated', '', 'Fix these in the dashboard, then save again. The live site keeps showing the last working version until then.', '');
    resolved.errors.forEach((e) => lines.push('- ' + e));
    lines.push('');
  } else lines.push('## ✅ Pages checked', '');
  if (warnings.size) { lines.push('### Things to look at (the site still updated)', ''); [...warnings].forEach((w) => lines.push('- ' + w)); lines.push(''); }
  lines.push('### Page structure', '');
  const out = (n, d) => { lines.push(`${'  '.repeat(d)}- **${n.title}** · ${n.status}${n.public ? ` · \`${n.path}\`` : ''} · ${describePlacement(n)}`); n.children.forEach((c) => out(c, d + 1)); };
  if (resolved.roots.length) resolved.roots.forEach((r) => out(r, 0)); else lines.push('_No pages yet. Create one in the dashboard under "Pages"._');
  lines.push('', `### Redirects (${resolved.redirects.length})`, '');
  resolved.redirects.forEach((r) => lines.push(`- \`${r.from}\` → \`${r.to}\` (${r.reason})`));
  lines.push(...extra);
  const text = lines.join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
}

if (resolved.errors.length) { report(); process.exit(1); }

if (CHECK_ONLY) {
  const next = updateHistory(history, resolved);
  if (JSON.stringify(next) !== JSON.stringify(history)) {
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    fs.writeFileSync(historyFile, JSON.stringify(next, null, 2) + '\n');
    console.log('Recorded new page addresses in content/system/url-history.json');
  }
  report();
  process.exit(0);
}

// ---------- Helpers for rendering ----------
function gitDates() {
  const map = {};
  try {
    const out = execFileSync('git', ['log', '--format=@%cs', '--name-only', '--', 'content'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let d = null;
    for (const line of out.split('\n')) { if (line.startsWith('@')) d = line.slice(1); else if (line && d && !map[line]) map[line] = d; }
  } catch { /* not a git checkout */ }
  return map;
}
const dates = gitDates();
const fileDate = (rel) => dates[rel] || null;

const notices = new Map(noticesList.map((n) => [n.id, { ...n, updated: n.updated || fileDate(`content/notices/${n.id}.json`) }]));
const noticeUse = new Map();
const uploadsDir = path.join(ROOT, 'public', 'uploads');
const fileInfo = (rel) => { if (!rel) return null; try { return { size: fs.statSync(path.join(uploadsDir, rel)).size }; } catch { warn(`A page uses the file "uploads/${rel}", but that file isn't in the uploads folder.`); return null; } };
const pageLink = (id) => { const n = resolved.byId.get(id); return n && n.public ? { url: withBase(BASE, n.path), title: n.title } : null; };
const ctx = { base: BASE, notices, pageLink, fileInfo, asset: (v) => mediaUrl(BASE, v), warn, onNoticeUsed: (id, where) => { if (!noticeUse.has(id)) noticeUse.set(id, new Set()); noticeUse.get(id).add(where.split(' → ')[0]); } };

const siteHref = (u) => { const w = webUrl(u); return w.startsWith('/') && !w.startsWith('//') && !w.startsWith(BASE) ? withBase(BASE, w) : w; };
const tree = siteTree(resolved);
const extras = [{ title: 'Home', path: '/' }];
if (site.show_universities !== false && universities.length) extras.push({ title: site.universities_label || 'Universities', path: '/universities/' });
const sideFor = (p) => renderSidebar(tree, p, BASE, extras);
const feedbackHtml = site.feedback_url ? `<a href="${esc(webUrl(site.feedback_url))}" target="_blank" rel="noopener">${esc(site.feedback_label || 'Feedback')} ↗</a>` : '';
const menuFor = () => feedbackHtml;
const footer = esc(site.footer_text || '');
const canonical = (p) => (SITE_URL ? SITE_URL + withBase(BASE, p).slice(BASE.length - 1) : '');

const writeOut = (rel, html) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const outPath = (p) => (p === '/' ? 'index.html' : p.replace(/^\//, '') + 'index.html');

// ---------- Build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
if (fs.existsSync(uploadsDir)) fs.cpSync(uploadsDir, path.join(DIST, 'uploads'), { recursive: true, filter: (s) => !s.endsWith('.gitkeep') });
// Public settings for assets/auth.js. The Supabase "anon" key is meant to be public; real protection is the database rules in supabase/setup.sql.
const authCfg = { url: (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''), key: (process.env.SUPABASE_ANON_KEY || '').trim(), authUrl: AUTH_URL, local: process.env.CMS_LOCAL === '1' };
if (!authCfg.url !== !authCfg.key) warn('Visitor sign-in is switched off: SUPABASE_URL and SUPABASE_ANON_KEY must both be set.');
if (!authCfg.url || !authCfg.key) { authCfg.url = ''; authCfg.key = ''; }
fs.writeFileSync(path.join(DIST, 'assets', 'config.js'), `export default ${JSON.stringify(authCfg)};\n`);

// Pages
let built = 0;
for (const n of resolved.byId.values()) {
  if (!n.public) continue;
  const crumbs = [...ancestors(n).map((a) => ({ title: a.title, url: withBase(BASE, a.path) })), { title: n.title, url: withBase(BASE, n.path), current: true }];
  const subpages = n.children.filter((c) => c.public && c.showIn !== 'links').map((c) => ({ title: c.title, url: withBase(BASE, c.path), description: c.data.description }));
  const sheet = renderPageSheet(n.data, ctx, { crumbs, subpages, where: `Page "${n.title}"` });
  writeOut(outPath(n.path), renderLayout({
    title: `${n.title} · ${site.site_name}`, description: n.data.description || site.description, base: BASE, siteName: site.site_name,
    menuHtml: menuFor(n.path), sidebar: sideFor(n.path), main: sheet, footer, canonical: canonical(n.path),
  }));
  built++;
}

// Home
{
  const pub = [...resolved.byId.values()].filter((n) => n.public);
  const featured = pub.filter((n) => n.data.featured);
  const cards = (list) => `<div class="grid">${list.map((n) => `<div class="note"><a class="cover" href="${esc(withBase(BASE, n.path))}"><h3>${esc(n.title)}</h3>${n.data.description ? `<p>${esc(n.data.description)}</p>` : ''}<p><b>Open →</b></p></a></div>`).join('')}</div>`;
  const btns = (home.buttons || []).map((b) => { const l = b.page ? pageLink(b.page) : b.url ? { url: siteHref(b.url) } : null; return l ? `<a class="btn${b.style === 'primary' ? ' primary' : ''}" href="${esc(l.url)}">${esc(b.label)}</a>` : ''; }).join('');
  const extra = renderBlocks(home.blocks, ctx, 'Home page');
  const sheet = `<article class="sheet"><div class="tape"></div>${home.eyebrow ? `<div class="eyebrow">${esc(home.eyebrow)}</div>` : ''}<h1>${esc(home.heading || site.site_name)}</h1><div class="prose">${home.intro ? md(home.intro) : ''}</div>${btns ? `<div class="actions">${btns}</div>` : ''}
${featured.length ? `<h2 class="section">${esc(home.featured_heading || 'Featured guides')}</h2>${cards(featured)}` : ''}
<div style="margin-top:28px">${extra.html}</div></article>`;
  writeOut('index.html', renderLayout({ title: site.site_name, description: site.description, base: BASE, siteName: site.site_name, menuHtml: menuFor('/'), sidebar: sideFor('/'), main: sheet, footer, canonical: canonical('/') }));
}

// Universities
if (universities.length && site.show_universities !== false) {
  const sorted = [...universities].sort((a, b) => (a.personal_rank_number ?? 999) - (b.personal_rank_number ?? 999) || a.university.localeCompare(b.university));
  const listSheet = `<article class="sheet flat wide"><div class="tape"></div><nav aria-label="Breadcrumb" class="eyebrow"><a href="${esc(withBase(BASE, ''))}">Home</a> → Universities</nav><h1 class="page-title">Universities</h1><p class="lede">${sorted.length} courses from my research spreadsheet, in my personal ranking order.</p><div class="label-row"><span class="tag verify">Research entries · not yet verified</span><span class="tag">Personal ranking = opinion</span></div><div style="margin-top:22px">${renderUniversityList(sorted, BASE)}</div><p class="dim" style="font-size:13px">A searchable explorer with filters and side-by-side comparison is coming in the next phase.</p></article>`;
  writeOut('universities/index.html', renderLayout({ title: `Universities · ${site.site_name}`, base: BASE, siteName: site.site_name, menuHtml: menuFor('/universities/'), sidebar: sideFor('/universities/'), main: listSheet, footer }));
  for (const u of sorted) writeOut(outPath(uniPath(u)), renderLayout({ title: `${u.university} – ${u.course} · ${site.site_name}`, base: BASE, siteName: site.site_name, menuHtml: menuFor(uniPath(u)), sidebar: sideFor(uniPath(u)), main: renderUniversity(u, ctx), footer }));
}

// Redirect pages for moved, renamed, deleted or unpublished pages
for (const r of resolved.redirects) {
  if (resolved.publicPaths.has(r.from) || r.from === '/' || r.from.startsWith('/universities/') || r.from.startsWith('/admin/')) continue;
  const to = /^https?:/i.test(r.to) ? r.to : withBase(BASE, r.to);
  const note = r.reason === 'moved' || r.reason === 'manual' ? 'This page has moved.' : 'This page has moved or been removed. Taking you to the nearest section.';
  writeOut(outPath(r.from), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title><meta name="robots" content="noindex"><link rel="canonical" href="${esc(to)}"><meta http-equiv="refresh" content="0; url=${esc(to)}"><script>location.replace(${JSON.stringify(to).replace(/</g, '\\u003c')} + location.hash)</script></head><body style="font-family:sans-serif;padding:40px"><p>${note} <a href="${esc(to)}">Continue →</a></p></body></html>`);
}

// 404
writeOut('404.html', renderLayout({ title: `Page not found · ${site.site_name}`, base: BASE, siteName: site.site_name, menuHtml: menuFor(''), sidebar: sideFor(''), noindex: true, footer,
  main: `<article class="sheet"><div class="tape"></div><div class="eyebrow">404</div><h1 class="page-title">This page isn't here.</h1><p>It may have been moved or taken down, or the address may have a typo.</p><div class="actions"><a class="btn primary" href="${withBase(BASE, '')}">Go to the home page</a></div></article>` }));

// ---------- Dashboard (Decap CMS) ----------
const ADMIN = path.join(DIST, 'admin');
fs.mkdirSync(path.join(ADMIN, 'lib'), { recursive: true });
const decapDir = path.join(ROOT, 'node_modules', 'decap-cms', 'dist');
for (const f of fs.readdirSync(decapDir)) if (/decap-cms\.js$/.test(f)) fs.copyFileSync(path.join(decapDir, f), path.join(ADMIN, f));
fs.copyFileSync(path.join(ROOT, 'node_modules', 'marked', 'lib', 'marked.esm.js'), path.join(ADMIN, 'lib', 'marked.esm.js'));
for (const f of fs.readdirSync(path.join(ROOT, 'build', 'render'))) fs.copyFileSync(path.join(ROOT, 'build', 'render', f), path.join(ADMIN, 'lib', f));
for (const f of fs.readdirSync(path.join(ROOT, 'admin'))) fs.copyFileSync(path.join(ROOT, 'admin', f), path.join(ADMIN, f));
const config = cmsConfig({ repo: CMS_REPO, branch: E.CMS_BRANCH || 'main', authUrl: AUTH_URL, authEndpoint: AUTH_ENDPOINT, base: BASE, siteUrl: SITE_URL, local: process.env.CMS_LOCAL === '1' });
fs.writeFileSync(path.join(ADMIN, 'config.yml'), JSON.stringify(config, null, 2));
// Data for the preview pane. Page titles and addresses only; the repository is public anyway, so drafts are not secret.
fs.writeFileSync(path.join(ADMIN, 'site-data.json'), JSON.stringify({
  base: BASE,
  pages: [...resolved.byId.values()].map((n) => ({ id: n.id, title: n.title, slug: n.slug, parent: n.parentId, order: n.order, status: n.status, show_in: n.showIn })),
  notices: [...notices.values()].filter((n) => n.status !== 'retired').map(({ internal_note, ...n }) => n),
}));

// ---------- Report ----------
const extra = ['', `### Saved notices (${notices.size})`, ''];
for (const n of notices.values()) {
  const used = noticeUse.get(n.id);
  extra.push(`- **${n.title}** (${n.status || 'active'}): ${used ? 'used on ' + [...used].join('; ') : 'not used anywhere yet'}`);
}
const big = [];
const walkUploads = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walkUploads(p); else { const s = fs.statSync(p).size; if (s > 25 * 1024 * 1024) big.push(`- \`${path.relative(uploadsDir, p)}\` is ${formatBytes(s)}. Files over about 25 MB make the site slow to publish; consider YouTube or an external link.`); } } };
walkUploads(uploadsDir);
if (big.length) extra.push('', '### Large files', '', ...big);
extra.push('', `Built ${built} page(s), ${universities.length} university page(s), ${resolved.redirects.length} redirect(s).`);
report(extra);
