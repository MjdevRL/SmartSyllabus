# Smart Syllabus: going live on Vercel (all free)

About 60 minutes, once. No credit card. You never paste a secret into the website's files: secrets only go into Vercel's settings page.

## What you're setting up

| Piece | Where | What it does | Free limit |
|---|---|---|---|
| **Your code** | GitHub | Stores the site and every page you write | free |
| **The website + editor login** | Vercel | Builds and hosts the site; also runs the little login that lets the editor save to GitHub | 100 GB traffic/month, 1M requests |
| **Accounts + database** | Supabase | Visitors sign in (Google or email link). Holds the list of admin emails | 50,000 monthly users, 500 MB |

**How admin works:** sign in on the website with your admin email → an **Admin mode** button appears at the top right → it opens the page editor. Only emails on your admin list see that button or can open the editor. Saving a page also needs GitHub write access, so the content stays protected even if someone guesses the editor address.

> **Two things to know first**
> 1. **Vercel's free (Hobby) plan is for personal, non-commercial projects.** A free student guide is fine. If the site ever earns money (ads, paid courses, sponsorship), you'd need Vercel's Pro plan or another free host.
> 2. **The pages themselves stay public.** Signing in gives people an account, but it cannot hide the pages, and a public GitHub repository is readable by anyone. That's right for a free public guide. If you later want pages that *only signed-in people* can read, that needs a small change (ask for it as a next step).

---

## Step 1: Put the code on GitHub

1. Create a free account at <https://github.com> if you don't have one.
2. **+ → New repository**. Name it `smart-syllabus`, choose **Public**, **Create repository**.
   *(Private also works, but see the note at Step 6.)*
3. Upload the project with **GitHub Desktop** (<https://desktop.github.com>):
   1. **File → Clone repository**, pick `smart-syllabus`, choose a folder.
   2. Unzip the project and copy everything inside into that folder, **including the hidden `.github` folder**. (Mac: `Cmd+Shift+.` in Finder shows hidden folders. Windows: View → Show → Hidden items.)
   3. Summary "First version" → **Commit to main** → **Push origin**.

## Step 2: Create the accounts database (Supabase)

1. Sign up at <https://supabase.com> (use "Continue with GitHub"). **New project**: name `smart-syllabus`, pick a region near your visitors, set a database password (save it in a password manager; this site never needs it). Wait about 2 minutes.
2. **SQL Editor → New query**. Open `supabase/setup.sql` from the project, paste all of it, and **change `you@example.com` on the last line to your admin email**. Click **Run**. It should say "Success".
3. **Project Settings → API** (called **API Keys** in newer versions). Copy two things into a note; you need them in Step 3:
   - **Project URL** (like `https://abcdxyz.supabase.co`)
   - The **anon / publishable** key (the one labelled *public*). **Never use the `service_role` / secret key.**

(Supabase menu names shift slightly over time; look for the same words.)

## Step 3: Publish the website (Vercel)

1. Sign up at <https://vercel.com> with **Continue with GitHub**. Choose the free **Hobby** plan.
2. **Add New… → Project**. Find `smart-syllabus` and click **Import**. If it isn't listed, click **Adjust GitHub App Permissions** and allow that repository.
3. On the setup screen **leave the build settings alone** (the project's `vercel.json` already sets them). Framework Preset can say "Other".
4. Open **Environment Variables** on that screen and add two (name, then value):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from Step 2 |
   | `SUPABASE_ANON_KEY` | the anon / publishable key from Step 2 |

5. Click **Deploy**. After 1–2 minutes you get a green "Congratulations" page. Click **Continue to Dashboard**.
6. Your **site address** is under **Domains** (e.g. `https://smart-syllabus.vercel.app`). Open it to see the site. **Write it down: every step below uses it.** (If the name `smart-syllabus` is taken, Vercel picks a variation. You can rename in **Settings → Domains**; just do it *now*, before the steps below, because the other services need the final address.)

> **If visitors see a Vercel login page instead of your site:** **Settings → Deployment Protection**, set **Vercel Authentication** to *Only Preview Deployments*, and save.

## Step 4: Tell Supabase your site address

Supabase → **Authentication → URL Configuration**:
- **Site URL:** your site address, e.g. `https://smart-syllabus.vercel.app`
- **Redirect URLs → Add URL:** `https://smart-syllabus.vercel.app/**` (keep the `**`). This lets people come back to the page they were on after signing in.

Save. Supabase's **Email** sign-in is already on.

> **Email limits:** Supabase's free built-in email sender only sends a few sign-in emails per hour. Fine for testing; for real visitors use Google sign-in (Step 5) and, later, a free email sender (Resend or Brevo) under **Authentication → SMTP**.

## Step 5: Add "Continue with Google" (recommended)

1. Go to <https://console.cloud.google.com>, sign in, **New project** named `Smart Syllabus`.
2. **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform**): choose **External**, app name `Smart Syllabus`, your email for support and developer contact, save through the steps. Then click **Publish app** so anyone can sign in, not only test users. The basic scopes used (email, profile) need no Google review.
3. **Credentials → Create credentials → OAuth client ID** → **Web application**.
   - **Authorized redirect URIs:** in Supabase open **Authentication → Sign In / Providers → Google** and copy the **Callback URL** shown there (ends in `/auth/v1/callback`); paste it here.
   - **Create**, then copy the **Client ID** and **Client secret**.
4. Back in Supabase on the Google provider screen: switch it **on**, paste both, **Save**.

## Step 6: Let the editor save pages (GitHub login)

The editor saves your pages into your GitHub repository, so it needs a GitHub login. Vercel runs that for you; you just create the GitHub "app" it uses.

1. GitHub: your picture → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Fill in: **Application name** `Smart Syllabus editor`; **Homepage URL** your site address; **Authorization callback URL** your site address + `/api/callback` (e.g. `https://smart-syllabus.vercel.app/api/callback`).
3. **Register application**, copy the **Client ID**, then **Generate a new client secret** and copy it too.
4. Vercel → your project → **Settings → Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `GITHUB_CLIENT_ID` | the Client ID |
   | `GITHUB_CLIENT_SECRET` | the client secret (tick **Sensitive** if offered) |

   Leave all environments ticked.
5. **Deployments** tab → the top deployment → **⋯ → Redeploy** → **Redeploy**. (New settings only apply to new deployments.)

> **Private repository?** Also add `GITHUB_SCOPE` = `repo,read:user` in Vercel, then redeploy. (Public repositories use the default and need nothing extra.)

## Step 7: Try it

1. Open your site address. You should see **Sign in** at the top right.
2. Sign in with Google (or the email link) using the **admin email** from Step 2.
3. **Admin mode** now appears at the top right next to **Sign out**. Click it.
4. In the editor click **Login with GitHub** and approve (once). You're in: add a page, press **Save**, and the site updates in 1–3 minutes (Vercel rebuilds automatically).
5. Check it the other way: sign in with a different email. It should show **no** Admin mode button, and opening `/admin/` should say "Not an admin account".

### Adding or removing admins later

Supabase → **SQL Editor** → `insert into public.admins (email) values ('new.person@example.com');` (lowercase). To remove: `delete from public.admins where email = 'new.person@example.com';`. Each admin also needs **write access to the GitHub repository** (repo **Settings → Collaborators**) to save pages. Everyone who has signed up is listed under **Authentication → Users**.

### Keeping the free database awake

Supabase pauses idle free projects after about a week. The project includes a small job that Vercel runs twice a week to prevent that (`vercel.json` + `api/keepalive.js`). Nothing to do. If a project is ever paused, open it in Supabase and click **Restore**.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| Vercel build fails | Open the failed deployment → **Build Logs**. The last lines say in plain English what to fix (e.g. two pages with the same address). The live site keeps its last good version. |
| No **Sign in** button at all | `SUPABASE_URL` / `SUPABASE_ANON_KEY` are missing or misspelled (Step 3.4), or you haven't redeployed since adding them. |
| After signing in you land on an error or a blank page | Step 4: **Site URL** and the **Redirect URL** (with `/**`) must match your site address exactly. |
| Google says "redirect_uri_mismatch" | Step 5.3: the redirect URI must be exactly the Callback URL shown in Supabase. |
| Email link doesn't arrive | Check spam; Supabase's free sender is rate-limited. Use Google sign-in or add SMTP (Step 4 note). |
| **Admin mode** never appears | The email you signed in with isn't in the admin list. Re-run the `insert` from Step 2.2 with the exact address (lowercase), then sign out and in. |
| Editor says "settings missing" in the login window | Step 6.4 names are misspelled, or you haven't redeployed since adding them. |
| Editor login window opens but nothing happens | The OAuth app's **callback URL** must be your site address + `/api/callback`, and you must be opening the editor from that same address (not a preview link). |
| "Repo not found" in the editor | You're signed into GitHub with an account that can't edit this repository. |
| Visitors see a Vercel login page | See the Deployment Protection note in Step 3. |
| Sign-in suddenly stopped after a quiet spell | Supabase paused the project: open it in Supabase and click **Restore**. |

## Custom domain (optional, later)

Vercel → **Settings → Domains → Add** and follow the instructions at your domain provider. Then: add `SITE_URL` = `https://yourdomain.com` in Vercel and redeploy; update **Site URL** and **Redirect URLs** in Supabase (Step 4); update the GitHub OAuth app's Homepage URL and callback URL (Step 6). Uploaded files keep working automatically.
