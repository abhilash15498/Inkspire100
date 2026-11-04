# Private novel review site

A private website where you publish your novel **one chapter at a time** and collect feedback from reviewers you invite.

* Your **Word document stays the master copy**. You publish only what you choose.
* Upload a chapter as **.docx or .pdf**, or paste the text into the editor.
* Save **drafts**; reviewers see nothing until you **publish**.
* Every publish is a permanent **version**. You can view and restore old ones.
* Reviewers sign in with **Google**, read published chapters and leave **feedback per chapter**.
* Chapter text, versions, reviewers and feedback live in **Neon PostgreSQL**. Uploaded .docx/.pdf originals are kept in separate **file storage** (optional).

> **Not included, on purpose:** uploading or versioning a full-book PDF. Everything works chapter by chapter.

---

## 1. What is in this folder

```
novel/
├─ backend/               The server (Node.js + Express)
│  ├─ sql/001_schema.sql  The database tables (applied automatically)
│  ├─ src/                Server code (routes/, storage/, services/, middleware/)
│  ├─ tests/              Automated tests
│  └─ .env.example        Settings template  -> copy to backend/.env
├─ frontend/              The website (React + Vite)
│  └─ src/                pages/ (reader), author/ (dashboard), components/
├─ render.yaml            Optional deployment blueprint (Render.com)
└─ README.md              This guide
```

In production **one** server hosts both the website and the API. This keeps sign-in cookies simple and secure.

## 2. Software to install (once)

1. **Node.js 20 or newer** (the LTS version): <https://nodejs.org>. Check with `node -v` in a terminal.
2. A code editor such as VS Code (optional but handy).

## 3. Accounts you must create yourself (the code cannot do these)

| Account | Used for | Cost |
|---|---|---|
| **Neon** (neon.com) | Database | Free plan |
| **Google Cloud** (console.cloud.google.com) | "Sign in with Google" | Free |
| **Cloudflare** (R2) | Keeping uploaded .docx/.pdf files *(only needed when deployed, optional locally)* | Free tier; needs a payment card on file |
| **Render** (render.com) | Hosting the site | Free plan (see limits) |
| **GitHub** | Holding the code so Render can deploy it | Free |

## 4. Create the database (Neon)

1. Sign up at neon.com and create a project (any name, nearest region).
2. On the project page click **Connect** and copy the connection string. It looks like `postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require`. Keep it secret.
3. That is all. **The tables are created automatically** the first time the server starts (or run `npm run migrate`).

## 5. Set up Google sign-in

> Neon Auth was considered. Its documentation only describes browser/Next.js use and cannot restrict sign-in to an invited list, so this project verifies Google sign-in itself on the server. Passwords are never stored.

1. Go to <https://console.cloud.google.com> and create a project.
2. **APIs & Services > OAuth consent screen**: choose *External*, fill in the app name and your email. Leave it in *Testing* mode and add your own email (and your reviewers') under **Test users**, **or** click *Publish app* so any invited reviewer can sign in. (Only people you invite in this site's Reviewers page get access either way.)
3. **APIs & Services > Credentials > Create credentials > OAuth client ID**, type **Web application**.
4. Under **Authorized JavaScript origins** add:
   * `http://localhost:5173` (for local use)
   * `http://localhost:4000`
   * your live address later, e.g. `https://your-site.onrender.com`
5. Create it and copy the **Client ID** (ends in `.apps.googleusercontent.com`). You do **not** need the client secret.

## 6. File storage for uploaded originals

When you import a .docx or .pdf, the **text** goes into the database. The **original file** can also be kept (you choose per upload). Files are stored by a *storage provider*:

* **Local computer** (`STORAGE_PROVIDER=local`): files go in `backend/uploads/`. Nothing to set up.
* **Cloudflare R2** (`STORAGE_PROVIDER=s3`), for the live site, because free hosts erase local files:
  1. Cloudflare dashboard > **R2** > create a bucket (leave it **private**, do not enable public access).
  2. R2 > **Manage API tokens** > create a token with *Object Read & Write* for that bucket. Copy the **Access Key ID** and **Secret Access Key**.
  3. Copy your **S3 API endpoint** (`https://<account-id>.r2.cloudflarestorage.com`).

Any S3-compatible service (Backblaze B2, AWS S3...) works with the same settings. To add another kind, create a file in `backend/src/storage/` with `put`, `get` and `delete`, and register it in `index.js`.

Files are **never public**. They are only served by the server after it checks who is asking. Reviewers can only get a chapter PDF you explicitly marked "Offer as a PDF link" while the chapter is published. Word files are author-only.

## 7. Create your settings file

```
cd backend
cp .env.example .env        (Windows: copy .env.example .env)
```

Open `backend/.env` and fill in:

* `DATABASE_URL`: the Neon string from step 4.
* `GOOGLE_CLIENT_ID`: from step 5.
* `AUTHOR_EMAILS`: **your own Google email**. This is how you become the author (step 9).
* `SESSION_SECRET`: a long random text. Generate one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
* `STORAGE_PROVIDER=local` for now.

Never share or upload `.env`. It is already excluded by `.gitignore`.

## 8. Install and run locally

From the `novel` folder:

```
npm install
npm run dev
```

Open **http://localhost:5173**. (The server runs on port 4000 and the website forwards `/api` to it.)

## 9. First sign-in: you are the author

Click *Sign in with Google* using the email you put in `AUTHOR_EMAILS`. You are automatically the author and see an **Author** link in the top bar. Nobody else can become author, and the role is decided by that setting, not by anything a user can change.

## 10. Daily use

**Add reviewers** — Author > **Reviewers**. Paste their Google email addresses. Nothing is emailed; send them the site address yourself. They must sign in with that same Google account. **Remove access** locks them out immediately; their past feedback is kept.

**Publish your first chapter**
1. Author > **+ New chapter**. Enter the number (0 = prologue) and title. Optionally choose a .docx/.pdf.
2. In the editor, read through the text. Fix anything the import flagged. Use **Preview** to see how readers will see it.
3. Click **Publish…**, optionally write what changed, and **Confirm and publish**. It is now **version 1**.

**Correct a few lines later**
1. Author > open the chapter > edit the text.
2. **Save draft** (reviewers still see the old text) or **Publish changes…** (creates the next version; the old one stays in history).
3. The note you write appears to reviewers as "What changed", and reviewers who commented earlier see *Updated since your feedback*.

**Replace a whole chapter from Word** — open the chapter > **Upload a file** > choose the .docx > *Import text into draft* > review > publish. Other chapters are untouched.

**Undo / restore** — chapter > **Version history** > *View*, *Load into draft*, or *Restore & publish* (this adds a new version; nothing is erased).

**Unpublish** — hides a chapter from reviewers without deleting anything. **Delete** (in a collapsed section) permanently removes the chapter, its versions, files and feedback.

**Read feedback** — Author > **Feedback inbox**: filter by chapter or reviewer, oldest/newest first, unread only, mark read.

**Formatting** — one line = one paragraph. `*italic*`, `**bold**`, a line with `***` for a scene break, `# Heading`, `> quote`, `\*` for a real asterisk. A Word import converts italics, bold, headings and scene breaks automatically. Pictures and tables are not imported. Old `.doc` files must be saved as `.docx` first. PDF import estimates paragraph breaks, so check it; `.docx` is more accurate. Scanned PDFs (pictures of pages) cannot be read.

## 11. Put it online (free-tier route)

1. Put the project on **GitHub** (private repository). Do not include `.env`.
2. In **Render**: *New > Blueprint*, pick the repository (it reads `render.yaml`), or *New > Web Service* with:
   * Build command: `npm install --include=dev && npm run build`
   * Start command: `npm run start`
3. Add the environment variables: `NODE_ENV=production`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `AUTHOR_EMAILS`, `SESSION_SECRET`, and for files `STORAGE_PROVIDER=s3` with the `S3_*` values from step 6.
4. When Render gives you the address (`https://xxxx.onrender.com`), add it to Google's **Authorized JavaScript origins** (step 5).
5. Open the address and sign in.

Other hosts (Railway, Fly.io, a VPS) work too: run `npm install && npm run build`, then `npm start`, with the same variables. If you split frontend and backend onto different domains, set `VITE_API_URL` (frontend build), and `APP_ORIGIN` plus `CROSS_SITE_COOKIES=true` (backend). The single-service setup is recommended.

## 12. Backups

* **Your Word file is the master copy.** Keep backing it up as usual.
* **Database:** Neon keeps short-term history on the free plan. For your own copy, run
  `pg_dump "YOUR_DATABASE_URL" > backup.sql` (needs PostgreSQL client tools). Do this after big editing sessions.
* **Uploaded originals:** download from the chapter's *Upload a file* tab, or copy the R2 bucket with Cloudflare's tools. All chapter text is already inside the database dump.

## 13. Free-tier limits (checked November 2026; they change, so recheck)

* **Neon Free:** 1 GB storage per project, 100 compute-hours/month, and the database **sleeps after 5 minutes idle**; the first request afterwards is slower. A novel's text is tiny and will not approach the storage limit.
* **Render Free:** the server **sleeps after 15 minutes without visitors** and takes about a minute to wake; 750 free hours a month; local disk is erased on every restart (this is why uploads go to R2). Render states free instances are not meant for production. A paid instance removes the sleep.
* **Cloudflare R2:** 10 GB storage and a monthly allowance of operations at no charge, with free downloads. A payment method is required to enable R2.
* **Google OAuth:** in *Testing* mode only listed test users can sign in and their sign-in expires after 7 days. *Publish app* to lift that (a basic sign-in-only app needs no Google verification).

## 14. Security summary

* Every action is checked **on the server**; hiding buttons is only cosmetic. Reviewers get 403 on every author route (tested).
* Sign-in is verified with Google's signature, audience and expiry. The email must be verified and either an author email or invited.
* Sessions are HttpOnly, SameSite cookies, re-checked against the database on **every** request, so removed reviewers are locked out at once.
* Only people you invite can ever sign in; strangers are not stored.
* Unpublished/draft text is never sent to reviewers. Published versions cannot be altered, even by direct database edits (a database trigger forbids it).
* All SQL is parameterised. Uploads are limited by type, real file contents and size (10 MB default, `MAX_UPLOAD_MB`), stored under random names in a private bucket.
* Cross-site request forgery guard, security headers (CSP), rate limits on sign-in and uploads, safe CORS, and no secrets in the code.
* Only your name and email are kept for reviewers. No passwords, no photos.

## 15. Tests

```
npm test                         # 39 backend tests + 5 frontend tests
```

Backend tests run against a real in-memory PostgreSQL (PGlite) with generated .docx and .pdf files. They cover sign-in, permissions, drafts, publishing, version restore, feedback privacy, imports, file access and storage.
An optional real-browser check is in `backend/tests/e2e-browser.mjs` (needs `npm run build` and Playwright installed).

## 16. Not tested here (needs your credentials)

* Live **Google sign-in** (tests use a stand-in for Google's token check; the real check uses Google's official library).
* Live **Neon** (tests use PGlite, a real Postgres engine; SQL is standard).
* Live **Cloudflare R2** (the S3 code is tested against a mock client).
* A deployed Render instance.

If something fails on first contact with these services, the server prints a plain-language message; the likeliest causes are a typo in `.env` or a missing Authorized JavaScript origin in Google.
