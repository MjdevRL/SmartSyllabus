// Generates admin/config.yml for Decap CMS (written as JSON, which is valid YAML).
// The dashboard's forms are defined here once and reused everywhere.

const str = (name, label, extra = {}) => ({ name, label, widget: 'string', required: false, ...extra });
const txt = (name, label, extra = {}) => ({ name, label, widget: 'text', required: false, ...extra });
const rich = (name, label, extra = {}) => ({
  name, label, widget: 'markdown', required: false, modes: ['rich_text', 'raw'], editor_components: [],
  buttons: ['bold', 'italic', 'link', 'heading-three', 'heading-four', 'bulleted-list', 'numbered-list', 'quote'], ...extra,
});
const bool = (name, label, def = false, extra = {}) => ({ name, label, widget: 'boolean', default: def, required: false, ...extra });
const date = (name, label, extra = {}) => ({ name, label, widget: 'datetime', required: false, date_format: 'D MMM YYYY', time_format: false, format: 'YYYY-MM-DD', picker_utc: true, ...extra });
const sel = (name, label, options, def, extra = {}) => ({ name, label, widget: 'select', options, default: def, required: false, ...extra });
const tags = (name = 'tags', label = 'Tags') => ({ name, label, widget: 'list', required: false, hint: 'Separate tags with commas, e.g. Maths, HL, Revision' });
const pagePicker = (name = 'page', label = 'Link to a page on this site', extra = {}) => ({
  name, label, widget: 'relation', collection: 'pages', value_field: '{{slug}}', search_fields: ['title'], display_fields: ['title'], required: false, ...extra,
});
const file = (name, label, extra = {}) => ({ name, label, widget: 'file', required: false, choose_url: false, ...extra });
const image = (name, label, extra = {}) => ({ name, label, widget: 'image', required: false, choose_url: false, ...extra });

const COLOURS = [
  { label: 'Yellow', value: 'yellow' }, { label: 'Pink', value: 'pink' }, { label: 'Blue', value: 'blue' },
  { label: 'Green', value: 'green' }, { label: 'Purple', value: 'purple' },
];
export const NOTICE_STYLE_OPTIONS = [
  { label: 'Subtle note (small grey text)', value: 'subtle' },
  { label: 'Highlighted warning (pink taped note)', value: 'warning' },
  { label: 'Information (blue note)', value: 'info' },
  { label: 'Source / verification (stamped card)', value: 'source' },
];
const PLACEMENT_BLOCK = [
  { label: 'Immediately after this', value: 'after' },
  { label: 'Before this', value: 'before' },
  { label: 'At the end of this section', value: 'section_end' },
  { label: 'At the bottom of the page', value: 'page_end' },
];
const PLACEMENT_PAGE = [
  { label: 'Bottom of the page', value: 'page_end' },
  { label: 'Top of the page (under the title)', value: 'page_top' },
];
const PLACEMENT_UNI = [
  { label: 'After the requirements (IB score)', value: 'after_requirements' },
  { label: 'After the tests', value: 'after_tests' },
  { label: 'After the costs', value: 'after_costs' },
  { label: 'After the salary figures', value: 'after_salary' },
  { label: 'After the personal ranking', value: 'after_ranking' },
  { label: 'Top of the entry', value: 'top' },
  { label: 'Bottom of the entry', value: 'bottom' },
];

const noticeSource = [
  str('source_label', 'Source name', { hint: 'e.g. "UCAS – International students"' }),
  str('source_url', 'Source link'),
  date('last_verified', 'Last verified'),
];

/** The "+ Add notice" list used on blocks, links, pages and university entries. */
export function noticesField(placements = PLACEMENT_BLOCK, label = 'Notices / disclaimers') {
  return {
    name: 'notices', label, label_singular: 'notice', widget: 'list', required: false, collapsed: true,
    hint: 'Optional. Add a saved notice (edit it once, it updates everywhere) or write a one-off notice.',
    typeKey: 'type',
    types: [
      {
        name: 'saved', label: 'Use a saved notice', widget: 'object', summary: 'Saved notice · {{fields.placement}}',
        fields: [
          { name: 'notice', label: 'Saved notice', widget: 'relation', collection: 'notices', value_field: '{{slug}}', search_fields: ['title', 'body'], display_fields: ['title'] },
          sel('placement', 'Where should it appear?', placements, placements[0].value),
        ],
      },
      {
        name: 'custom', label: 'Write a one-off notice', widget: 'object', summary: '{{fields.title}} · {{fields.placement}}',
        fields: [
          str('title', 'Title'),
          rich('body', 'Text', { required: true }),
          sel('style', 'Style', NOTICE_STYLE_OPTIONS, 'info'),
          str('label', 'Label override', { hint: 'Replaces the small heading, e.g. "Estimate" instead of "Good to know".' }),
          ...noticeSource,
          date('updated', 'Notice last updated'),
          sel('placement', 'Where should it appear?', placements, placements[0].value),
        ],
      },
    ],
  };
}

const linkTarget = [
  pagePicker('page', 'Link to a page on this site', { hint: 'Pick a page… (this link keeps working if the page moves)' }),
  str('url', '…or a web address', { hint: 'Used only if no page is picked above. e.g. https://www.ucas.com' }),
];

const BLOCKS = [
  { name: 'text', label: 'Text', widget: 'object', summary: '{{fields.heading}}', fields: [str('heading', 'Heading'), rich('body', 'Text'), noticesField()] },
  { name: 'section', label: 'Section heading (starts a new section)', widget: 'object', summary: '{{fields.heading}}', fields: [str('heading', 'Section heading', { required: true }), rich('intro', 'Intro text'), noticesField()] },
  {
    name: 'links', label: 'Links', widget: 'object', summary: '{{fields.heading}}',
    fields: [
      str('heading', 'Heading', { default: 'Useful links' }),
      {
        name: 'items', label: 'Links', label_singular: 'link', widget: 'list', summary: '{{fields.title}}', collapsed: true,
        fields: [
          str('title', 'Link title', { required: true }),
          ...linkTarget,
          txt('description', 'What is this link for?'),
          sel('new_tab', 'Open in', [{ label: 'Automatic (new tab for other websites)', value: 'auto' }, { label: 'Same tab', value: 'same' }, { label: 'New tab', value: 'new' }], 'auto'),
          bool('official', 'This is an official source'),
          date('last_verified', 'Last verified'),
          tags(),
          tags('subjects', 'Subjects'),
          tags('countries', 'Countries'),
          noticesField(),
        ],
      },
      noticesField(),
    ],
  },
  {
    name: 'file', label: 'Document / download', widget: 'object', summary: '{{fields.title}}',
    fields: [
      str('title', 'Document title', { required: true }),
      txt('description', 'Description'),
      txt('who_for', 'What it contains / who should use it'),
      sel('source', 'Where is the file?', [{ label: 'Upload a file (PDF, Word, PowerPoint, Excel, TXT… up to about 25 MB)', value: 'upload' }, { label: 'Link to a file stored elsewhere (Google Drive, OneDrive, a website…)', value: 'link' }], 'upload'),
      file('file', 'File (if uploading)', { hint: 'To replace an outdated document, choose a new file here. The title and description stay the same.' }),
      str('url', 'File link (if stored elsewhere)'),
      str('category', 'Category'),
      tags(),
      date('last_reviewed', 'Last reviewed'),
      noticesField(),
    ],
  },
  {
    name: 'media', label: 'Video or audio', widget: 'object', summary: '{{fields.title}}',
    fields: [
      str('title', 'Title', { required: true }),
      txt('description', 'Description'),
      sel('source', 'Where is it?', [
        { label: 'YouTube video (embedded on the page)', value: 'youtube' },
        { label: 'Upload a file (MP3 or small MP4, up to about 25 MB)', value: 'upload' },
        { label: 'Link to a file stored elsewhere', value: 'link' },
      ], 'youtube'),
      str('url', 'YouTube link or external file link', { hint: 'For YouTube, paste the normal video link, e.g. https://www.youtube.com/watch?v=…' }),
      file('file', 'Audio or video file (if uploading)'),
      file('captions', 'Captions file (.vtt, for uploaded videos)'),
      rich('transcript', 'Transcript'),
      noticesField(),
    ],
  },
  { name: 'image', label: 'Image', widget: 'object', summary: '{{fields.caption}}', fields: [image('image', 'Image', { required: true }), str('alt', 'Describe the image for people who can’t see it', { required: true }), str('caption', 'Caption'), noticesField()] },
  { name: 'gallery', label: 'Image gallery', widget: 'object', summary: '{{fields.heading}}', fields: [str('heading', 'Heading'), { name: 'images', label: 'Images', label_singular: 'image', widget: 'list', collapsed: true, fields: [image('image', 'Image', { required: true }), str('alt', 'Describe the image', { required: true }), str('caption', 'Caption')] }, noticesField()] },
  {
    name: 'table', label: 'Table', widget: 'object', summary: '{{fields.heading}}',
    fields: [
      str('heading', 'Heading'),
      txt('data', 'Table contents', { hint: 'Copy cells from Excel or Google Sheets and paste them here. Or type one row per line with commas between cells.' }),
      bool('has_header', 'First row is the header row', true),
      str('caption', 'Caption / note under the table'),
      noticesField(),
    ],
  },
  { name: 'callout', label: 'Callout (coloured note)', widget: 'object', summary: '{{fields.title}}', fields: [str('title', 'Title'), rich('body', 'Text'), sel('colour', 'Colour', COLOURS, 'yellow'), noticesField()] },
  {
    name: 'cards', label: 'Cards', widget: 'object', summary: '{{fields.heading}}',
    fields: [str('heading', 'Heading'), { name: 'items', label: 'Cards', label_singular: 'card', widget: 'list', summary: '{{fields.title}}', collapsed: true, fields: [str('title', 'Title', { required: true }), txt('text', 'Text'), sel('colour', 'Colour', COLOURS, 'yellow'), ...linkTarget] }, noticesField()],
  },
  { name: 'faq', label: 'FAQ', widget: 'object', summary: '{{fields.heading}}', fields: [str('heading', 'Heading', { default: 'Questions' }), { name: 'items', label: 'Questions', label_singular: 'question', widget: 'list', summary: '{{fields.question}}', collapsed: true, fields: [str('question', 'Question', { required: true }), rich('answer', 'Answer')] }, noticesField()] },
  { name: 'buttons', label: 'Buttons', widget: 'object', fields: [{ name: 'items', label: 'Buttons', label_singular: 'button', widget: 'list', summary: '{{fields.label}}', fields: [str('label', 'Button text', { required: true }), ...linkTarget, sel('style', 'Style', [{ label: 'Dark (main action)', value: 'primary' }, { label: 'Outlined', value: 'plain' }], 'plain')] }, noticesField()] },
  { name: 'notice', label: 'Notice on its own', widget: 'object', fields: [noticesField(PLACEMENT_BLOCK, 'Notices')] },
];

export const blocksField = (label = 'Page content') => ({
  name: 'blocks', label, label_singular: 'block', widget: 'list', required: false, typeKey: 'type', types: BLOCKS,
  hint: 'Click "Add block" to add text, links, documents, videos, tables and more. Drag blocks to reorder them.',
});

// The simple editor: pages made of Text and Link items only.
const SIMPLE_BLOCKS = [
  { name: 'text', label: 'Text', widget: 'object', summary: '{{fields.body}}', fields: [rich('body', 'Text', { required: true })] },
  {
    name: 'link', label: 'Link', widget: 'object', summary: '{{fields.title}}',
    fields: [
      str('title', 'Link title', { required: true }),
      str('url', 'URL', { required: true, hint: 'e.g. https://www.ucas.com' }),
      txt('description', 'Description'),
    ],
  },
];

export function cmsConfig({ repo, branch = 'main', authUrl, authEndpoint = 'auth', base = '/', siteUrl = '', local = false }) {
  const backend = { name: 'github', repo: repo || 'OWNER/REPOSITORY', branch, squash_merges: true };
  if (authUrl) { backend.base_url = authUrl.replace(/\/+$/, ''); backend.auth_endpoint = authEndpoint; }
  return {
    ...(local ? { local_backend: true } : {}),
    backend,
    site_url: siteUrl || undefined,
    display_url: siteUrl || undefined,
    media_folder: 'public/uploads',
    public_folder: (base.endsWith('/') ? base : base + '/') + 'uploads',
    slug: { encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' },
    collections: [
      {
        name: 'pages', label: 'Pages', label_singular: 'page', folder: 'content/pages', create: true, delete: true,
        format: 'json', extension: 'json', identifier_field: 'title',
        slug: 'p{{year}}{{month}}{{day}}-{{hour}}{{minute}}{{second}}',
        summary: '{{title}}  ·  {{status}}',
        sortable_fields: ['title'],
        fields: [
          str('title', 'Page title', { required: true }),
          pagePicker('parent', 'Parent page', { hint: 'Optional. Pick a page to put this one under it in the sidebar.' }),
          sel('status', 'Status', [{ label: 'Published', value: 'published' }, { label: 'Draft (not on the website)', value: 'draft' }], 'published'),
          { name: 'blocks', label: 'Content', label_singular: 'item', widget: 'list', required: false, typeKey: 'type', types: SIMPLE_BLOCKS, hint: 'Click "Add item" and choose Text or Link. Drag to reorder.' },
        ],
      },
      {
        name: 'settings', label: 'Settings', delete: false,
        files: [
          { name: 'home', label: 'Home page', file: 'content/settings/home.json', fields: [str('heading', 'Heading', { required: true }), rich('intro', 'Text')] },
          { name: 'site', label: 'Site name and footer', file: 'content/settings/site.json', editor: { preview: false }, fields: [str('site_name', 'Site name', { required: true }), str('footer_text', 'Footer text')] },
        ],
      },
    ],
  };
}
