# bff calendar ♡

See when your besties are free — across time zones.

**Live:** https://bffcalendar.netlify.app/

- `index.html`, `app.js`, `config.js` — the whole app (static files, no build step)
- Backend: Supabase project **bff-calendar** (org PisoPilot), free tier
- Database: `profiles`, `circles`, `circle_members`, `blocks` with row-level security —
  people only see others in a circle they share.
- Sign-in: anonymous (one tap) + optional email link to keep the account across devices.

## Run locally
Any static server works, e.g. `npx serve .` then open http://localhost:3000
(add that URL under Supabase → Authentication → URL Configuration → Redirect URLs for email links).

## Status (Nov 14)
- Database + security rules: done and tested (circle members see each other; outsiders see nothing).
- Anonymous sign-in: enabled in Supabase.
- Live on Netlify (free, auto-deploys from GitHub). Done: set Supabase → Authentication → URL Configuration → Site URL to the live link
  so "save my account" emails work.
- Test leftovers to delete when convenient (Supabase SQL editor):
    delete from public.circles where name = 'TEST circle';
    delete from auth.users where id in (select id from public.profiles where nick like 'TEST-%');

## Free-tier limits to know
- Supabase free projects pause after ~1 week with no activity (open the app or dashboard to wake it).
- Built-in email sends only a few emails per hour — fine for friends; add a free SMTP (e.g. Resend) before going SaaS.

## Deploying updates
Netlify project **bffcalendar** is linked to this repo: every push to `main` deploys automatically
(no build step; files served from the repo root).
