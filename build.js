#!/usr/bin/env node
/**
 * Zero-dependency static site builder for Grind & Brew.
 * Reads markdown files with YAML-ish frontmatter from src/, renders them
 * through src/_includes/base.html, and writes static HTML to _site/.
 *
 * Deliberately dependency-free (no npm install required) so a scheduled
 * GitHub Actions run can never fail because of an npm registry outage or
 * a broken transitive dependency — it only needs Node itself.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "_site");

// UPDATE THIS the moment a real domain is chosen — canonical tags and
// structured data both need an absolute URL to be worth anything. Wrong
// domain here is worse than no canonical tag at all.
const SITE_URL = process.env.SITE_URL || "https://example.com";

function readFile(p) {
  return fs.readFileSync(p, "utf8");
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const [, fm, body] = match;
  const data = {};
  fm.split("\n").forEach((line) => {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) {
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      data[m[1]] = value;
    }
  });
  return { data, body };
}

// Minimal markdown -> HTML. Supports: headings, paragraphs, bold, links,
// unordered lists. Strips HTML comments (used in source as editorial
// TODO markers, e.g. affiliate-link placeholders) from the rendered output.
function renderMarkdown(md) {
  const withoutComments = md.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutComments.split("\n");
  let html = "";
  let inList = false;

  function inline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      const level = heading[1].length + 1; // markdown H1 in source -> render as H2, keeps one true <h1> per page (the title)
      html += `<h${level}>${inline(heading[2])}</h${level}>\n`;
      continue;
    }
    const listItem = line.match(/^-\s+(.*)$/);
    if (listItem) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${inline(listItem[1])}</li>\n`;
      continue;
    }
    if (inList) {
      html += "</ul>\n";
      inList = false;
    }
    html += `<p>${inline(line)}</p>\n`;
  }
  if (inList) html += "</ul>\n";
  return html;
}

function renderPage(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

function articleSchema({ title, description, permalink, date }) {
  const canonical = SITE_URL.replace(/\/$/, "") + permalink;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: description,
    url: canonical,
    datePublished: date,
    author: { "@type": "Organization", name: "Grind & Brew" },
  };
  return JSON.stringify(schema);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writePage(outPath, html) {
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, html);
}

function copyDir(srcDir, outDir) {
  ensureDir(outDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const o = path.join(outDir, entry.name);
    if (entry.isDirectory()) copyDir(s, o);
    else fs.copyFileSync(s, o);
  }
}

function build() {
  const template = readFile(path.join(SRC, "_includes", "base.html"));

  // Collect articles
  const articlesDir = path.join(SRC, "articles");
  const articleFiles = fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter((f) => f.endsWith(".md"))
    : [];

  const articles = articleFiles.map((file) => {
    const raw = readFile(path.join(articlesDir, file));
    const { data, body } = parseFrontmatter(raw);
    return { data, bodyHtml: renderMarkdown(body) };
  });
  articles.sort((a, b) => (a.data.date < b.data.date ? 1 : -1));

  // Render each article
  for (const article of articles) {
    const contentHtml = `<h1>${article.data.title}</h1>\n${article.bodyHtml}`;
    const canonical = SITE_URL.replace(/\/$/, "") + article.data.permalink;
    const schemaJson = articleSchema(article.data);
    const page = renderPage(template, {
      title: article.data.title,
      description: article.data.description || "",
      content: contentHtml,
      canonical,
      schema: `<script type="application/ld+json">${schemaJson}</script>`,
    });
    const permalink = article.data.permalink.replace(/^\/|\/$/g, "");
    writePage(path.join(OUT, permalink, "index.html"), page);
  }

  // Render standalone pages (about, disclosure)
  const standalonePages = ["about.md", "disclosure.md"];
  for (const file of standalonePages) {
    const raw = readFile(path.join(SRC, file));
    const { data, body } = parseFrontmatter(raw);
    const contentHtml = `<h1>${data.title}</h1>\n${renderMarkdown(body)}`;
    const canonical = SITE_URL.replace(/\/$/, "") + data.permalink;
    const page = renderPage(template, {
      title: data.title,
      description: data.description || "",
      content: contentHtml,
      canonical,
      schema: "",
    });
    const permalink = data.permalink.replace(/^\/|\/$/g, "");
    writePage(path.join(OUT, permalink, "index.html"), page);
  }

  // Render index page listing all articles
  const listItems = articles
    .map(
      (a) =>
        `<li><a href="${a.data.permalink}">${a.data.title}</a><p>${a.data.description}</p></li>`
    )
    .join("\n");
  const indexContent = `
<section class="hero">
  <h1>Home espresso gear, explained plainly.</h1>
  <p>No listicles padded to 3,000 words, no fake "we tested 40 machines" claims. Just clear guides to help you buy the right gear once, written and maintained by an AI research assistant and reviewed for accuracy — see our <a href="/about/">about page</a> for exactly how this site works.</p>
</section>
<section class="article-list">
  <h2>Latest guides</h2>
  <ul>
  ${listItems}
  </ul>
</section>`;
  const indexPage = renderPage(template, {
    title: "Home",
    description: "Straightforward, no-nonsense guides to home espresso and coffee gear.",
    content: indexContent,
    canonical: SITE_URL.replace(/\/$/, "") + "/",
    schema: "",
  });
  writePage(path.join(OUT, "index.html"), indexPage);

  // Copy static assets
  copyDir(path.join(SRC, "static"), path.join(OUT, "static"));

  // robots.txt + simple sitemap
  const siteUrl = SITE_URL.replace(/\/$/, "");
  fs.writeFileSync(
    path.join(OUT, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`
  );
  const urls = ["/", "/about/", "/disclosure/", ...articles.map((a) => a.data.permalink)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${siteUrl}${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);

  console.log(`Built ${articles.length} articles + ${standalonePages.length} pages to _site/`);
}

build();
