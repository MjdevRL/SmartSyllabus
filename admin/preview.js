// Dashboard preview pane: shows pages, notices, universities and the home page
// using the real website styles and the same rendering code as the live site.
import { renderPageSheet } from './lib/page.mjs';
import { renderBlocks } from './lib/blocks.mjs';
import { renderNotice } from './lib/notices.mjs';
import { renderUniversity } from './lib/universities.mjs';
import { resolveSite, ancestors, describePlacement } from './lib/hierarchy.mjs';
import { esc, withBase, mediaUrl } from './lib/util.mjs';
import { md } from './lib/markdown.mjs';

const CMS = window.CMS;
const h = window.h;
let data = { base: '/', pages: [], notices: [] };
try { data = await (await fetch('site-data.json', { cache: 'no-store' })).json(); } catch { /* first run */ }
const BASE = data.base || '/';

CMS.registerPreviewStyle(withBase(BASE, 'assets/fonts/fonts.css'));
CMS.registerPreviewStyle(withBase(BASE, 'assets/reference.css'));
CMS.registerPreviewStyle(withBase(BASE, 'assets/site.css'));
CMS.registerPreviewStyle('body{padding:24px 16px}.preview-bar{font-family:ui-monospace,monospace;font-size:12px;line-height:1.7;border:1px solid #3d3d3d;border-radius:10px;background:#202020;color:#ebebeb;padding:10px 14px;margin:0 auto 26px;max-width:820px}.preview-bar b{font-family:"DM Sans",sans-serif}.preview-warn{color:#f08ea0}', { raw: true });

const notices = new Map(data.notices.map((n) => [n.id, n]));

function makeCtx(props, warnings) {
  return {
    base: BASE,
    notices,
    warn: (w) => warnings.push(w.replace(/^[^:]*: /, '')),
    fileInfo: () => null,
    asset: (v) => { if (!v) return ''; try { const a = props.getAsset(v); const s = a && String(a); if (s && s !== '[object Object]') return s; } catch { /* ignore */ } return mediaUrl(BASE, v); },
    pageLink: (id) => { const p = data.pages.find((x) => x.id === id); return p ? { url: '#', title: p.title } : null; },
  };
}

const html = (s) => h('div', { dangerouslySetInnerHTML: { __html: s } });
const bar = (lines, warnings) => `<div class="preview-bar">${lines.map((l) => `<div>${l}</div>`).join('')}${warnings.length ? `<div class="preview-warn"><b>Check:</b> ${warnings.map(esc).join(' · ')}</div>` : ''}</div>`;

function PagePreview(props) {
  const entry = props.entry.get('data').toJS();
  const id = props.entry.get('slug') || '__this_page__';
  const others = data.pages.filter((p) => p.id !== id);
  const site = resolveSite([...others, { ...entry, id }], {});
  const node = site.byId.get(id);
  const warnings = [...site.errors, ...site.warnings.filter((w) => w.includes(`"${node.title}"`))];
  const ctx = makeCtx(props, warnings);
  const crumbs = [...ancestors(node).map((a) => ({ title: a.title, url: '#' })), { title: node.title, current: true }];
  const subs = node.children.filter((c) => c.public).map((c) => ({ title: c.title, url: '#', description: '' }));
  const sheet = renderPageSheet(entry, ctx, { crumbs, subpages: subs });
  const statusWord = { draft: 'Draft · not on the website', published: node.public ? 'Published · on the website' : 'Published, but hidden until its parent page is published', hidden: 'Hidden · not on the website', archived: 'Archived · visitors are sent to the parent page' }[node.status] || node.status;
  return html(bar([
    `<b>Preview</b> · ${esc(statusWord)}`,
    `Address: ${esc(withBase(BASE, node.path))}`,
    esc(node.public ? describePlacement(node) : 'Navigation: ' + describePlacement({ ...node, public: true, children: node.children })),
    'Links in the preview are disabled. Save to update the live site.',
  ], warnings) + `<div class="layout"><div style="width:min(850px,100%);margin:0 auto">${sheet}</div></div>`);
}

function NoticePreview(props) {
  const n = props.entry.get('data').toJS();
  return html(bar([`<b>Notice preview</b> · ${esc(n.status === 'retired' ? 'Retired · hidden everywhere' : 'Active')}`], []) + `<div style="max-width:850px;margin:0 auto" class="sheet flat">${renderNotice(n)}</div>`);
}

function UniversityPreview(props) {
  const u = { ...props.entry.get('data').toJS(), id: props.entry.get('slug') || 'new' };
  const warnings = [];
  const out = renderUniversity(u, makeCtx(props, warnings));
  return html(bar([`<b>Preview</b> · ${u.status === 'draft' ? 'Draft · not on the website' : 'Published'}`], warnings) + `<div style="max-width:850px;margin:0 auto">${out}</div>`);
}

function HomePreview(props) {
  const d = props.entry.get('data').toJS();
  const warnings = [];
  const { html: blocks } = renderBlocks(d.blocks, makeCtx(props, warnings), 'Home');
  return html(bar(['<b>Home page preview</b> · featured and recently updated pages are added automatically on the live site'], warnings)
    + `<div style="max-width:850px;margin:0 auto" class="sheet"><div class="tape"></div>${d.eyebrow ? `<div class="eyebrow">${esc(d.eyebrow)}</div>` : ''}<h1>${esc(d.heading || '')}</h1><div class="prose">${d.intro ? md(d.intro) : ''}</div>${(d.buttons || []).length ? `<div class="actions">${d.buttons.map((b) => `<span class="btn${b.style === 'primary' ? ' primary' : ''}">${esc(b.label)}</span>`).join('')}</div>` : ''}<div style="margin-top:28px">${blocks}</div></div>`);
}

// Wording: in this dashboard the button only SAVES. The "Status" field decides whether
// something is on the website, so "Publish" is renamed to "Save" to avoid two meanings.
try {
  const en = structuredClone(CMS.getLocale('en'));
  Object.assign(en.editor.editorToolbar, { publish: 'Save', publishing: 'Saving…', published: 'Saved', publishNow: 'Save', publishAndCreateNew: 'Save and create new', publishAndDuplicate: 'Save and duplicate' });
  en.ui.toast.entryPublished = 'Saved. If the status is "Published", the website updates in 1–3 minutes.';
  CMS.registerLocale('en', en);
} catch (e) { console.warn('Could not adjust dashboard wording', e); }

CMS.registerPreviewTemplate('pages', PagePreview);
CMS.registerPreviewTemplate('notices', NoticePreview);
CMS.registerPreviewTemplate('universities', UniversityPreview);
CMS.registerPreviewTemplate('home', HomePreview);
CMS.init();
