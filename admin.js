// The editor. No login: it talks straight to your Supabase database with the public key in config.js.
// Reading, saving, deleting and history all go through the REST calls in api() below.
import { CONFIG } from './config.js';
import { renderPreview } from './lib/render/site.mjs';
import { resolveSite, updateHistory } from './lib/render/hierarchy.mjs';
import { esc } from './lib/render/util.mjs';

const BASE = new URL('./', location.href).pathname;
const $ = (s) => document.querySelector(s);

// What the Home and Site settings screens edit: [field, label, input kind]
const FORMS = {
  home: { title: 'Home page', fields: [['heading', 'Heading', 'input'], ['intro', 'Intro text (markdown works)', 'textarea']] },
  site: { title: 'Site settings', fields: [['site_name', 'Site name', 'input'], ['description', 'Short description (shown in search results)', 'textarea'], ['footer_text', 'Footer text', 'input']] },
};
const BLOCKS = {
  text: { label: 'Text', blank: () => ({ type: 'text', body: '' }) },
  link: { label: 'Link', blank: () => ({ type: 'link', title: '', url: '', description: '' }) },
};

const state = { rows: [], view: { kind: 'page', id: null }, draft: null, saved: '', hist: [] };

// ---------- database ----------
async function api(path, init = {}) {
  let r;
  try { r = await fetch(`${CONFIG.url}/rest/v1/${path}`, { ...init, headers: { apikey: CONFIG.key, 'content-type': 'application/json', ...init.headers } }); }
  catch { throw new Error("Couldn't reach the database. Check your internet connection and try again."); }
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!r.ok) throw new Error(body?.message || `The database refused that (error ${r.status}).`);
  return body;
}
const upsert = (kind, id, data) => api('content?on_conflict=kind,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ kind, id, data }) });
const reload = async () => { state.rows = await api('content?select=kind,id,data'); };

// ---------- helpers ----------
const pagesOf = (rows) => rows.filter((r) => r.kind === 'page').map((r) => ({ ...r.data, id: r.id }));
const settingOf = (id, rows = state.rows) => rows.find((r) => r.kind === 'setting' && r.id === id)?.data;
const historyOf = () => settingOf('url-history') || {};
const redirectsOf = () => settingOf('redirects')?.items || [];
const siteOf = (rows) => resolveSite(pagesOf(rows), { history: historyOf(), extraRedirects: redirectsOf() });
const clone = (x) => JSON.parse(JSON.stringify(x));
const dirty = () => !!state.draft && JSON.stringify(state.draft) !== state.saved;
const newId = () => { const d = new Date().toISOString().replace(/\D/g, ''); return `p${d.slice(0, 8)}-${d.slice(8, 14)}${Math.random().toString(36).slice(2, 4)}`; };
const fmt = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, bad ? 7000 : 2600);
}

/** The page being edited, placed among the saved pages: used for the preview, the address and the checks. */
function trial() {
  const id = state.view.id || '__new__';
  const others = state.rows.filter((r) => !(r.kind === 'page' && r.id === id));
  const rows = [...others, { kind: 'page', id, data: state.draft }];
  const before = siteOf(state.rows), after = siteOf(rows);
  return {
    res: after, id,
    errors: after.errors.filter((e) => !before.errors.includes(e)),
    warnings: after.warnings.filter((w) => !before.warnings.includes(w)),
  };
}

// ---------- views ----------
function setView(view, draft, saved) {
  state.view = view; state.draft = draft; state.saved = saved ?? JSON.stringify(draft);
  renderSide(); renderMain(); refreshPreview();
}
function guard() { return !dirty() || confirm('You have unsaved changes. Leave without saving?'); }

function openPage(id) {
  if (!guard()) return;
  const row = state.rows.find((r) => r.kind === 'page' && r.id === id);
  if (row) setView({ kind: 'page', id }, clone({ title: '', parent: '', status: 'draft', blocks: [], ...row.data }));
}
function newPage() {
  if (!guard()) return;
  setView({ kind: 'page', id: null }, { title: '', parent: '', status: 'draft', blocks: [BLOCKS.text.blank()] });
}
function openSetting(kind) {
  if (!guard()) return;
  setView({ kind }, clone(settingOf(kind) || {}));
}
async function openHistory() {
  if (!guard()) return;
  setView({ kind: 'history' }, null);
  try {
    state.hist = (await api('content_history?select=n,kind,id,data,op,changed_at&kind=in.(page,setting)&id=neq.url-history&order=n.desc&limit=60')) || [];
  } catch (e) { toast(e.message, true); state.hist = []; }
  renderMain();
}
function restore(n) {
  const h = state.hist.find((x) => x.n === n);
  if (!h) return;
  const data = clone(h.data);
  if (h.kind === 'page') setView({ kind: 'page', id: h.id }, { title: '', parent: '', status: 'draft', blocks: [], ...data }, '');
  else if (FORMS[h.id]) setView({ kind: h.id }, data, '');
  else return;
  toast('Old version loaded. Press Save to bring it back.');
}

// ---------- drawing ----------
function renderShell() {
  $('#app').innerHTML = `<header class="top"><b>Smart Syllabus editor</b><span class="sp"></span>
    ${CONFIG.publicSite ? `<a class="btn sm" href="${esc(CONFIG.publicSite)}" target="_blank" rel="noopener">View site ↗</a>` : ''}
    <button class="btn sm" data-act="refresh">Refresh</button></header>
    <div class="shell"><nav class="side" id="side" aria-label="Pages"></nav><section class="main" id="main"></section>
    <aside class="prev"><iframe id="prev" sandbox="allow-scripts" title="Live preview"></iframe></aside></div>`;
}

function renderSide() {
  const res = siteOf(state.rows), v = state.view;
  const on = (kind, id) => v.kind === kind && (id === undefined || v.id === id) ? ' on' : '';
  const row = (n) => `<button class="item${on('page', n.id)}" style="padding-left:${10 + n.depth * 16}px" data-act="open" data-id="${esc(n.id)}">${esc(n.title)}${n.status === 'published' ? '' : '<span class="d">draft</span>'}</button>${n.children.map(row).join('')}`;
  $('#side').innerHTML = `<button class="btn primary sm" data-act="new">+ New page</button>
    <div class="grp">Pages</div>${res.roots.map(row).join('') || '<p class="hint" style="padding:0 10px">No pages yet.</p>'}
    <div class="grp">Site</div>
    <button class="item${on('home')}" data-act="setting" data-k="home">Home page</button>
    <button class="item${on('site')}" data-act="setting" data-k="site">Site settings</button>
    <button class="item${on('history')}" data-act="history">History &amp; restore</button>`;
}

function parentOptions() {
  const res = siteOf(state.rows), self = state.view.id, skip = new Set();
  if (self) { const mark = (n) => { skip.add(n.id); n.children.forEach(mark); }; const me = res.byId.get(self); if (me) mark(me); }
  const out = [`<option value="">None (top level)</option>`];
  const walk = (n) => { if (skip.has(n.id)) return; out.push(`<option value="${esc(n.id)}"${n.id === state.draft.parent ? ' selected' : ''}>${'— '.repeat(n.depth)}${esc(n.title)}</option>`); n.children.forEach(walk); };
  res.roots.forEach(walk);
  return out.join('');
}

const blockHtml = (b, i, n) => `<div class="block"><div class="bh"><b>${BLOCKS[b.type]?.label || esc(b.type)}</b><span class="sp"></span>
  <button class="btn sm" data-act="up" data-i="${i}" aria-label="Move up"${i ? '' : ' disabled'}>↑</button>
  <button class="btn sm" data-act="down" data-i="${i}" aria-label="Move down"${i < n - 1 ? '' : ' disabled'}>↓</button>
  <button class="btn sm" data-act="rm" data-i="${i}" aria-label="Remove block">✕</button></div>
  ${b.type === 'text' ? `<label>Text<textarea data-b="${i}" data-f="body" rows="6">${esc(b.body || '')}</textarea></label><p class="hint">Markdown works: **bold**, *italic*, # Heading, - list, [words](https://address)</p>`
    : b.type === 'link' ? `<label>Link title<input data-b="${i}" data-f="title" value="${esc(b.title || '')}"></label><label>Web address<input data-b="${i}" data-f="url" value="${esc(b.url || '')}" placeholder="https://"></label><label>Short description (optional)<input data-b="${i}" data-f="description" value="${esc(b.description || '')}"></label>` : ''}</div>`;

const saveBar = (extra = '') => `<div class="bar"><button class="btn primary" data-act="save">Save</button><button class="btn ghost" data-act="discard">Undo changes</button><span id="dirty"></span><span class="sp"></span>${extra}</div>`;

function renderMain() {
  const v = state.view, d = state.draft, m = $('#main');
  if (v.kind === 'history') {
    m.innerHTML = `<h2>History &amp; restore</h2><p class="hint">Every time a page or setting is changed or deleted, the old version is kept here (the latest 500 changes). Restore opens the old version in the editor; press Save to bring it back.</p>` +
      (state.hist.length ? state.hist.map((h) => `<div class="hist"><div><b>${esc(h.data.title || h.data.heading || h.data.site_name || h.id)}</b><br><small>${h.op === 'delete' ? 'Deleted' : 'Earlier version'} · ${esc(h.kind === 'page' ? 'page' : h.id === 'home' ? 'home page' : 'site settings')} · ${esc(fmt(h.changed_at))}</small></div><span class="sp"></span>${h.kind === 'page' || FORMS[h.id] ? `<button class="btn sm" data-act="restore" data-n="${h.n}">Restore</button>` : ''}</div>`).join('') : '<p class="hint">Nothing here yet.</p>');
    return;
  }
  if (FORMS[v.kind]) {
    m.innerHTML = `<h2>${FORMS[v.kind].title}</h2>${FORMS[v.kind].fields.map(([f, label, kind]) => `<label>${label}${kind === 'textarea' ? `<textarea data-f="${f}" rows="6">${esc(d[f] || '')}</textarea>` : `<input data-f="${f}" value="${esc(d[f] || '')}">`}</label>`).join('')}${saveBar()}`;
    changed(); return;
  }
  m.innerHTML = `<h2>${v.id ? 'Edit page' : 'New page'}</h2>
    <label>Title<input data-f="title" value="${esc(d.title)}" placeholder="e.g. Choosing your subjects"></label>
    <label>Parent page<select data-f="parent">${parentOptions()}</select></label>
    <label>Status<select data-f="status"><option value="draft"${d.status === 'draft' ? ' selected' : ''}>Draft: hidden from visitors</option><option value="published"${d.status === 'published' ? ' selected' : ''}>Published: visible to everyone</option></select></label>
    <p class="hint">Address: <code id="addr"></code></p>
    <h3>Content</h3><div id="blocks">${d.blocks.map((b, i) => blockHtml(b, i, d.blocks.length)).join('')}</div>
    <div class="row"><button class="btn sm" data-act="add" data-t="text">+ Text</button><button class="btn sm" data-act="add" data-t="link">+ Link</button></div>
    <div class="issues" id="issues"></div>
    ${saveBar(v.id ? '<button class="btn ghost" data-act="delete">Delete page</button>' : '')}`;
  changed();
}

/** Cheap updates while typing: the unsaved marker, address and problems list. The preview follows a moment later. */
let previewTimer;
function changed() {
  const v = state.view; if (!state.draft) return;
  const dirt = $('#dirty'); if (dirt) dirt.textContent = dirty() ? '● Unsaved changes' : '';
  if (v.kind === 'page') {
    const t = trial(), n = t.res.byId.get(t.id);
    $('#addr').textContent = n ? (n.public ? n.path : `${n.path} (not public yet)`) : '';
    $('#issues').innerHTML = [...t.errors.map((e) => `<div class="issue err"><b>Fix before saving:</b> ${esc(e)}</div>`), ...t.warnings.map((w) => `<div class="issue warn">${esc(w)}</div>`)].join('');
  }
  clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, 200);
}

const NO_NAV = '<script>document.addEventListener("click",function(e){if(e.target.closest("a"))e.preventDefault()},true)<\/script>';
function refreshPreview() {
  const v = state.view; let html = '';
  try {
    if (v.kind === 'page') html = renderPreview(state.rows, BASE, 'page', { ...state.draft, id: v.id || undefined });
    else if (v.kind === 'home') html = renderPreview(state.rows, BASE, 'home', state.draft);
    else if (v.kind === 'site') html = renderPreview([...state.rows.filter((r) => !(r.kind === 'setting' && r.id === 'site')), { kind: 'setting', id: 'site', data: state.draft }], BASE, 'home', settingOf('home') || {});
    else html = '<body style="background:#191919;color:#9b9b9b;font:15px system-ui;padding:30px">Pick a page to see its preview.</body>';
  } catch (e) { html = `<body style="background:#191919;color:#f08ea0;font:15px system-ui;padding:30px">The preview could not be drawn: ${esc(e.message)}</body>`; }
  $('#prev').srcdoc = html.includes('</body>') ? html.replace('</body>', NO_NAV + '</body>') : html + NO_NAV;
}

// ---------- actions ----------
async function save() {
  const v = state.view, d = state.draft;
  try {
    if (v.kind === 'page') {
      if (!d.title.trim()) return toast('Give the page a title first.', true);
      const t = trial();
      if (t.errors.length) return toast('This can\'t be saved yet. See "Fix before saving" below the content.', true);
      const id = v.id || newId();
      await upsert('page', id, { ...d, title: d.title.trim() });
      await reload();
      // remember this page's public address so old links keep working if it is later moved or renamed
      const hist = updateHistory(historyOf(), siteOf(state.rows));
      if (JSON.stringify(hist) !== JSON.stringify(historyOf())) { await upsert('setting', 'url-history', hist); await reload(); }
      state.view = { kind: 'page', id };
    } else { await upsert('setting', v.kind, d); await reload(); }
    state.saved = JSON.stringify(state.draft);
    renderSide(); renderMain(); refreshPreview(); toast('Saved.');
  } catch (e) { toast(e.message, true); }
}

async function remove() {
  const id = state.view.id, res = siteOf(state.rows), n = res.byId.get(id);
  if (!n) return;
  if (n.children.length) return toast(`"${n.title}" has ${n.children.length} subpage${n.children.length === 1 ? '' : 's'}. Move or delete them first.`, true);
  if (!confirm(`Delete "${n.title}"? You can bring it back later from History & restore.`)) return;
  try {
    await api(`content?kind=eq.page&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    await reload(); state.draft = null;
    setView({ kind: 'page', id: null }, { title: '', parent: '', status: 'draft', blocks: [BLOCKS.text.blank()] });
    toast('Page deleted. It is in History & restore.');
  } catch (e) { toast(e.message, true); }
}

function moveBlock(i, by) {
  const b = state.draft.blocks, j = i + by;
  if (j < 0 || j >= b.length) return;
  [b[i], b[j]] = [b[j], b[i]]; renderMain(); refreshPreview();
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const { act, id, k, t, n } = el.dataset, i = Number(el.dataset.i);
  if (act === 'open') openPage(id);
  else if (act === 'new') newPage();
  else if (act === 'setting') openSetting(k);
  else if (act === 'history') openHistory();
  else if (act === 'restore') restore(Number(n));
  else if (act === 'save') save();
  else if (act === 'delete') remove();
  else if (act === 'discard') { if (dirty() && !confirm('Throw away your unsaved changes?')) return; state.draft = JSON.parse(state.saved); renderMain(); refreshPreview(); }
  else if (act === 'add') { state.draft.blocks.push(BLOCKS[t].blank()); renderMain(); refreshPreview(); }
  else if (act === 'rm') { if (confirm('Remove this block?')) { state.draft.blocks.splice(i, 1); renderMain(); refreshPreview(); } }
  else if (act === 'up') moveBlock(i, -1);
  else if (act === 'down') moveBlock(i, 1);
  else if (act === 'refresh') { if (!guard()) return; try { await reload(); renderSide(); const v = state.view; if (v.kind === 'page' && v.id) openPageFresh(v.id); else if (FORMS[v.kind]) setView(v, clone(settingOf(v.kind) || {})); else renderMain(); toast('Refreshed.'); } catch (err) { toast(err.message, true); } }
});
function openPageFresh(id) { const row = state.rows.find((r) => r.kind === 'page' && r.id === id); if (row) setView({ kind: 'page', id }, clone({ title: '', parent: '', status: 'draft', blocks: [], ...row.data })); else newPage(); }

document.addEventListener('input', (e) => {
  const f = e.target.dataset?.f; if (f === undefined || !state.draft) return;
  if (e.target.dataset.b !== undefined) state.draft.blocks[Number(e.target.dataset.b)][f] = e.target.value;
  else state.draft[f] = e.target.value;
  changed();
});
window.addEventListener('beforeunload', (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

// ---------- start ----------
async function start() {
  try { await reload(); }
  catch (e) { $('#app').innerHTML = `<p class="boot">${esc(e.message)} <button class="btn sm" onclick="location.reload()">Try again</button></p>`; return; }
  renderShell();
  const first = siteOf(state.rows).roots[0];
  if (first) openPageFresh(first.id); else newPage();
}
start();
