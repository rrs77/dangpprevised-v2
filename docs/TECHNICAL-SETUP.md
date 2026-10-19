<!-- Technical notes for whoever hosts the site. The editor how-to is docs/ADMIN-GUIDE.md. -->

# Global Place Partners website: Technical setup

## Architecture

- React + Vite single-page app (`src/`), served by Vercel as static files.
- Express API (`server/app.js`, exposed on Vercel via `api/index.mjs`) for content, admin and the contact form.
- Content store (`server/store.js`): **Postgres** when `DATABASE_URL` is set, otherwise a JSON file (`data/cms.json`, or `/tmp/gpp-data` on Vercel). Initial content comes from `server/seed.js` the first time the store is empty.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | **Yes** | Long random string used to sign admin session cookies. The admin will not work without it. Changing it signs everyone out. |
| `ADMIN_PASSWORD` | **Yes** | The superuser password (sign in with empty email). Change it here to reset it. |
| `DATABASE_URL` | **Yes in production** | Postgres connection string. Without it, edits on Vercel are not saved permanently. |
| `DATABASE_SSL` | No | `true`/`false` to force SSL on/off. SSL is used automatically on Vercel or with `sslmode=require`; `sslmode=disable` turns it off. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | No | Send contact-form emails via Resend. Without them, enquiries are only stored (history tab). |
| `CONTACT_TO_EMAILS` | No | Comma-separated recipients; overrides the recipient set in brand. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Production | Cloudflare Turnstile spam check on the form. Defaults are Cloudflare's always-pass test keys, which provide no protection. |

Admin passwords for editors are stored hashed (scrypt). Session cookies are HTTP-only, `SameSite=Lax`, `Secure` in production, and expire after 24 hours. The contact form is limited to 5 submissions per hour per IP.

## Deploying on Vercel

1. Import the GitHub repo `rrs77/dangpprevised-v2` into Vercel. Build settings come from `vercel.json` (`npm run build`, output `dist`, `/api/*` routed to the Express app, everything else to the SPA).
2. Create a Postgres database (e.g. Vercel Marketplace → Neon, or any hosted Postgres) and copy its connection string.
3. In Project → Settings → Environment Variables add `SESSION_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL` and, as needed, the Resend and Turnstile variables. Redeploy.
4. Visit `/admin`, sign in and publish once to confirm saving works.

### Postgres

No manual SQL is needed. On first start the app creates its tables (`cms_state` for content, `cms_media` for uploaded images) and fills them from `server/seed.js` if empty.

Important: once the database contains content, **changes to `server/seed.js` are not applied** to it. Seed changes only affect a brand-new database. Edit live content in the admin. If you point v2 at a database already used by an older version of the site, it will show that older content (the new home sections, stats, quote, LinkedIn band etc. won't appear). Use a fresh database for v2, or add the sections in the admin.

If the database can't be reached at start-up, the app logs `Postgres unavailable; serving the built-in site content.` and serves the seed content; edits in that state are not saved to the database.

### Storage and uploads

- With Postgres, uploaded images are stored **in the database** (`cms_media`) and served from `/api/media/<id>`, so they persist across deploys. Nothing else is required.
- Without `DATABASE_URL` on Vercel, content and uploads go to `/tmp`, which is temporary and per-instance: edits will vanish. Always set `DATABASE_URL` in production.
- Locally without Postgres, content is in `data/cms.json` and uploads in the `data/` folder. Delete `data/cms.json` to reset to the seed.

## Local development

`server/dev.js` does not read a `.env` file, so pass variables in the shell:

```bash
npm install
SESSION_SECRET=dev-secret ADMIN_PASSWORD=dev npm run dev
#   API on http://127.0.0.1:3001, site + admin on http://127.0.0.1:5173

npm run build                      # production build into dist/
SESSION_SECRET=dev-secret ADMIN_PASSWORD=dev npm start
#   serves dist/ and the API together on http://127.0.0.1:3001
```

Add `DATABASE_URL=postgres://...` to test against Postgres.

## Smoke test

With the server running (e.g. `npm start` as above), in another terminal:

```bash
ADMIN_PASSWORD=dev npm run smoke          # BASE defaults to http://127.0.0.1:3001
```

It checks public pages and the API, signs in, edits and publishes a draft (then restores the original text), adds a person with a photo, reorders and deletes them, creates/edits/hides/deletes a LinkedIn post, and tests the contact form. Run it against a local or staging copy, not the live site: it publishes changes while it runs.


## Notes for the technical team (from the editor side)

- Superuser sign-in: leave the email empty and use `ADMIN_PASSWORD`. Sessions last 24 hours.
- Insights articles, LinkedIn posts, media uploads and editor accounts are saved live; everything else is draft until Publish.
- The last 40 published revisions are kept; Restore (superuser only) makes that version live and replaces the draft.
- Uploads: JPG, PNG, WebP or GIF, up to 8 MB.
- LinkedIn embed URLs must start `https://www.linkedin.com/embed/`; post URLs must be on linkedin.com.
- Stat items whose title starts with `[` are styled as placeholders.
