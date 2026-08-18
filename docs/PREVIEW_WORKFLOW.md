# Preview-first design workflow

`main` is the production branch. Do not commit or push design changes directly to
`main`. Cloudflare Pages' Git integration should deploy every other branch as a
preview and must never treat a `preview/*` branch as production.

## One-time Cloudflare check

In **Cloudflare dashboard -> Workers & Pages -> grind-and-brew -> Settings ->
Builds & deployments**, confirm:

- Production branch: `main`
- Preview deployments: enabled for all non-production branches
- Build command: `node build.js`
- Build output directory: `_site`

These settings leave `https://grind-and-brew.pages.dev` attached to `main`. A
preview branch receives a separate URL, normally shown in the Cloudflare
deployment and on its GitHub pull request.

## Design-change process

1. Start from the latest `main` and create a branch named
   `preview/<short-description>`; for example, `preview/article-layout-a3`.
2. Make the changes on that branch and run `node build.js`.
3. Push the branch and open a pull request into `main`. Do not merge it yet.
4. Wait for both the GitHub **Build check** and Cloudflare Pages deployment to
   finish.
5. Open the Cloudflare **Preview** link on the pull request. If it is not shown,
   open Cloudflare's **Deployments** list, select the matching branch, and use
   **View deployment**.
6. Chris reviews the desktop and mobile layouts and records approval (or changes
   requested) on the pull request.
7. Iterate by pushing more commits to the same branch; Cloudflare refreshes the
   preview without changing production.
8. Merge only after Chris approves and the build passes. Merging to `main` is the
   step that releases the change to production.
9. Delete the preview branch after the production deployment succeeds.

## Review checklist

- Homepage, affected article pages, navigation, and links work.
- Desktop and mobile layouts look intentional.
- Typography, images, product cards, and disclosures are correct.
- The preview URL is a Cloudflare branch/commit URL, not the production URL.
- GitHub's **Build check** passes.
- Chris has explicitly approved the pull request.

Preview pages may contain production canonical URLs because `SITE_URL` is set to
the public site in `wrangler.toml`. That is intentional: a temporary preview URL
must not become the canonical address indexed by search engines.
