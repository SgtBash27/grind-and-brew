# Grind & Brew — automated content/affiliate site prototype

This is a working prototype, not a mockup. Everything in here runs: `node build.js`
produces real static HTML from the markdown articles right now, with zero npm
dependencies (deliberate — see "Why no framework" below).

## What's real vs. what's still a placeholder

**Real and working:**
- The site itself: 3 genuine, hand-written guides, an about page, and an affiliate
  disclosure page (legally necessary once affiliate links go live).
- The build script (`build.js`) — converts markdown + frontmatter to static HTML,
  generates `sitemap.xml`, `robots.txt`, per-page canonical tags, Open Graph tags,
  and Article structured data (JSON-LD).
- **Before deploying, set `SITE_URL` to the real domain** — either export it as an
  env var when building (`SITE_URL=https://yourdomain.com node build.js`) or add it
  as a Vercel environment variable. Every canonical tag and schema block is wrong
  until this is set to the real domain — worth double-checking this is right
  before the first deploy, since a wrong canonical tag is worse than none.
- The weekly content-generation workflow (`.github/workflows/generate-article.yml`)
  — pulls the next topic from `topics-queue.json`, calls the Anthropic API to draft
  it in the site's house style, verifies the build still succeeds, and commits the
  result. This is the actual automation loop.

**Still placeholders, on purpose:**
- Every article has an `AFFILIATE LINK PLACEHOLDER` HTML comment where a specific
  product recommendation + affiliate link should go. I did not invent product
  names, models, or prices — those would likely be wrong or stale, and fabricated
  specifics in an affiliate article are exactly the kind of thing that damages
  trust and search rankings. Once you have an Amazon Associates (or similar)
  account, I can fill these in properly using real, current product data.
- `generate-article.js` references model `claude-sonnet-4-5-20250929` as a
  default — double-check that's the current model slug in the Anthropic docs
  before relying on it long-term; model names get superseded.

## Why no framework (no Eleventy/Next.js/etc.)

The sandbox I built this in has restricted network access and couldn't reach the
npm registry to install anything. Rather than hand you untested code, I wrote a
~150-line dependency-free build script instead. This turned out to be a genuine
upgrade, not just a workaround: a scheduled GitHub Actions run now can never fail
because of an npm registry outage or a broken transitive dependency — it only
needs Node itself, which GitHub's runners always have. If you'd rather have the
extra features a real static site generator gives you (pagination, RSS, etc.),
this can be swapped for Eleventy later without changing the folder structure.

## One-time setup (the parts that legally have to be you)

I can't create accounts that need your identity or bank details — that's a hard
line, not a preference. Here's exactly what's left, in the order to do it:

1. **GitHub account + repo.** If you don't have one: github.com/signup (free).
   Create a new empty repository, then push this folder to it:
   ```
   cd content-site
   git init && git add -A && git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo-name>.git
   git push -u origin main
   ```
2. **Turn on write access for the automation.** In the repo: Settings → Actions →
   General → "Workflow permissions" → select "Read and write permissions". Without
   this, the weekly article workflow can generate content but can't commit it.
3. **Anthropic API key**, for the content-generation workflow: console.anthropic.com
   → API Keys → Create Key. Then in the repo: Settings → Secrets and variables →
   Actions → New repository secret → name it `ANTHROPIC_API_KEY`.
4. **Vercel account**, to make the site actually live: vercel.com/signup → "Import
   Project" → pick this GitHub repo. Vercel reads `vercel.json` automatically and
   redeploys on every push to `main` — including the weekly auto-commits. You get
   a free `*.vercel.app` URL immediately; a custom domain (~£10/year from any
   registrar) can be attached later once you're happy with it.
5. **Monetization account(s), whenever you're ready to actually earn from this**:
   Amazon Associates (affiliateprogram.amazon.co.uk) and/or Google AdSense
   (adsense.google.com). Both need your bank/tax details for payouts — again,
   that's unavoidably you. Once you have one, send me the affiliate ID/format and
   I'll fill in every `AFFILIATE LINK PLACEHOLDER` with real product picks.

Everything after that — new articles, builds, deploys — runs on its own weekly,
with no further input needed from you. You'll still want to skim new articles
occasionally and glance at Vercel/AdSense dashboards, but the loop doesn't need
you to function.

## Local commands

```
node build.js          # build the site to _site/
node scripts/generate-article.js   # requires ANTHROPIC_API_KEY env var set
```
