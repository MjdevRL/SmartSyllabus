# Smart Syllabus

A free guidance website for IB Diploma students, hosted on Vercel. Visitors can sign in (Supabase); admins get an **Admin mode** button that opens the page editor at `/admin/`.

- **First-time setup:** [docs/SETUP.md](docs/SETUP.md)
- **How to edit content:** [docs/EDITING.md](docs/EDITING.md)

## How it fits together

```
Dashboard (/admin, Decap CMS) ──save──▶ content/*.json in this repository
        │ sign-in                              │ every save triggers
        ▼                                      ▼
Vercel function (api/auth.js)           Vercel: test → build → publish
                                        GitHub Actions: check pages, record addresses
```

| Folder | What's in it |
|---|---|
| `content/` | All site content, written by the dashboard. Pages, notices, universities, settings. |
| `public/uploads/` | Files uploaded through the dashboard |
| `assets/` | Design: `reference.css` (colours, buttons), `site.css` (layout, components), `site.js` (button tilt, copy link), `auth.js` (sign-in and Admin mode button), fonts |
| `build/` | The site builder. `render/` is shared with the dashboard preview. |
| `admin/` | Dashboard page (opens for admin emails only) and preview |
| `supabase/` | `setup.sql`: the admin list and the "am I an admin?" check |
| `api/`, `lib/` | Vercel functions: the editor's GitHub sign-in and the database keep-awake ping |
| `vercel.json` | Build settings for Vercel |
| `tests/` | Automated checks (run on every publish) |

## For developers

```
npm install
npm run dev      # site at http://localhost:8080, dashboard at /admin (saves to this folder, no login)
npm test
npm run build    # outputs dist/
```
