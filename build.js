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

const SITE_URL = process.env.SITE_URL || "https://grind-and-brew.pages.dev";

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

// Hand-authored, dependency-free SVG diagrams, keyed by name. Referenced
// from article markdown via a {{diagram:key}} marker line (see renderMarkdown
// below) rather than raw HTML, since the markdown parser doesn't support
// arbitrary HTML passthrough — this keeps the build script simple while
// still letting articles carry real explanatory illustrations, not just
// stock photography.
const DIAGRAMS = {
  "burr-vs-blade": `<figure class="diagram">
<svg viewBox="0 0 600 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="bvb-title bvb-desc">
  <title id="bvb-title">Blade vs burr grind particle consistency</title>
  <desc id="bvb-desc">Blade grinders produce a random mix of large and tiny particles; burr grinders produce uniform particles because the gap between the burrs is fixed.</desc>
  <rect x="10" y="10" width="270" height="210" rx="10" fill="#f6efe3" stroke="#e3d5c0"/>
  <rect x="320" y="10" width="270" height="210" rx="10" fill="#f6efe3" stroke="#e3d5c0"/>
  <text x="145" y="34" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-weight="700" fill="#2b1c14">Blade grinder</text>
  <text x="455" y="34" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-weight="700" fill="#2b1c14">Burr grinder</text>
  <text x="145" y="52" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="11" fill="#79695a">random particle sizes</text>
  <text x="455" y="52" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="11" fill="#79695a">uniform particle size</text>
  <g fill="#a8522a">
    <circle cx="45" cy="90" r="9"/><circle cx="80" cy="75" r="3"/><circle cx="110" cy="100" r="13"/>
    <circle cx="150" cy="80" r="4"/><circle cx="190" cy="95" r="10"/><circle cx="230" cy="72" r="6"/>
    <circle cx="60" cy="130" r="6"/><circle cx="100" cy="145" r="11"/><circle cx="140" cy="125" r="3"/>
    <circle cx="180" cy="150" r="8"/><circle cx="220" cy="135" r="14"/><circle cx="250" cy="115" r="5"/>
    <circle cx="70" cy="180" r="12"/><circle cx="115" cy="190" r="4"/><circle cx="160" cy="175" r="7"/>
    <circle cx="200" cy="188" r="9"/><circle cx="240" cy="170" r="3"/>
  </g>
  <g fill="#4a5d43">
    <circle cx="365" cy="85" r="7"/><circle cx="400" cy="85" r="7"/><circle cx="435" cy="85" r="7"/>
    <circle cx="470" cy="85" r="7"/><circle cx="505" cy="85" r="7"/><circle cx="540" cy="85" r="7"/>
    <circle cx="382" cy="115" r="7"/><circle cx="417" cy="115" r="7"/><circle cx="452" cy="115" r="7"/>
    <circle cx="487" cy="115" r="7"/><circle cx="522" cy="115" r="7"/>
    <circle cx="365" cy="145" r="7"/><circle cx="400" cy="145" r="7"/><circle cx="435" cy="145" r="7"/>
    <circle cx="470" cy="145" r="7"/><circle cx="505" cy="145" r="7"/><circle cx="540" cy="145" r="7"/>
    <circle cx="382" cy="175" r="7"/><circle cx="417" cy="175" r="7"/><circle cx="452" cy="175" r="7"/>
    <circle cx="487" cy="175" r="7"/><circle cx="522" cy="175" r="7"/>
  </g>
</svg>
<figcaption>Blade grinders chop beans into a random mix of sizes; burr grinders crush them through a fixed gap, so particle size stays consistent. That consistency is what determines whether a shot extracts evenly.</figcaption>
</figure>`,
};

// Small per-category line-art icons used on homepage cards and article meta
// rows. Hand-authored inline SVG, same zero-dependency constraint as the
// diagrams above — deliberately generic/decorative, not a claimed photo of
// specific hardware (see Amendment 1 imagery-strategy note in the shared
// project doc: illustration is fine as a stand-in, factual product photos
// are not, until they're real and licensed).
const CATEGORY_ICONS = {
  Grinding: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#e2a869" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="#e2a869" stroke-width="1.8"/></svg>`,
  Budget: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#e2a869" stroke-width="1.8"/><path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1 2.5 2c0 3-5 1.5-5 4.5 0 1 1.1 2 2.5 2s2.5-1.1 2.5-2.5" stroke="#e2a869" stroke-width="1.4" fill="none"/></svg>`,
  Machines: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 21V10a6 6 0 0112 0v11" stroke="#e2a869" stroke-width="1.8"/><path d="M4 21h16" stroke="#e2a869" stroke-width="1.8"/></svg>`,
};
const DEFAULT_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="12" rx="7" ry="9" transform="rotate(-18 12 12)" stroke="#e2a869" stroke-width="1.8"/></svg>`;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function wordCount(text) {
  return text.replace(/[#*_`\[\]()>-]/g, " ").split(/\s+/).filter(Boolean).length;
}

function readingTime(text) {
  return Math.max(1, Math.round(wordCount(text) / 200));
}

// Minimal markdown -> HTML. Supports: headings (collected into `headingsOut`
// for the "on this page" sidebar), paragraphs, bold, links, unordered lists,
// {{diagram:key}} markers, and {{takeaway: ...}} key-takeaway callout markers.
// Strips HTML comments (used in source as editorial TODO markers, e.g.
// affiliate-link placeholders) from the rendered output.
function renderMarkdown(md, headingsOut) {
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
    const diagramMarker = line.match(/^\{\{diagram:(.+?)\}\}$/);
    if (diagramMarker) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      const diagram = DIAGRAMS[diagramMarker[1]];
      if (!diagram) {
        throw new Error(`Unknown diagram key: "${diagramMarker[1]}"`);
      }
      html += diagram + "\n";
      continue;
    }
    const takeawayMarker = line.match(/^\{\{takeaway:\s*(.+?)\}\}$/);
    if (takeawayMarker) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      html += `<div class="callout"><div class="callout-label">Key takeaway</div><p>${inline(
        takeawayMarker[1]
      )}</p></div>\n`;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      const level = heading[1].length + 1; // markdown H1 in source -> render as H2, keeps one true <h1> per page (the title)
      const text = inline(heading[2]);
      const id = slugify(heading[2]);
      if (headingsOut) headingsOut.push({ text: heading[2], id });
      html += `<h${level} id="${id}">${text}</h${level}>\n`;
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
    const headings = [];
    const bodyHtml = renderMarkdown(body, headings);
    return { data, bodyHtml, headings, minutes: readingTime(body) };
  });
  articles.sort((a, b) => (a.data.date < b.data.date ? 1 : -1));

  // Render each article
  for (const article of articles) {
    const category = article.data.category || "Guides";
    const tocHtml = article.headings.length
      ? `<aside class="article-toc"><div class="toc-label">On this page</div><ul>${article.headings
          .map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
          .join("")}</ul></aside>`
      : "";
    const contentHtml = `
<div class="article-meta"><span class="cat">${category}</span><span>${article.minutes} min read</span></div>
<h1 class="article-title">${article.data.title}</h1>
<div class="article-layout">
  <div class="article-main">${article.bodyHtml}</div>
  ${tocHtml}
</div>`;
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
    const contentHtml = `<h1 class="article-title">${data.title}</h1>\n<div class="article-main">${renderMarkdown(
      body
    )}</div>`;
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
  const findArticle = (slugPart) => articles.find((a) => a.data.permalink.includes(slugPart));

  const cardItems = articles
    .map((a) => {
      const category = a.data.category || "Guides";
      const icon = CATEGORY_ICONS[category] || DEFAULT_ICON;
      return `<li class="card">
  <div class="card-art">${icon}</div>
  <div class="card-body">
    <div class="card-cat">${category}</div>
    <a class="card-title" href="${a.data.permalink}">${a.data.title}</a>
    <p>${a.data.description}</p>
    <div class="read-time">${a.minutes} min read &rarr;</div>
  </div>
</li>`;
    })
    .join("\n");

  const budgetArticle = findArticle("budget-breakdown");
  const grindArticle = findArticle("burr-vs-blade");
  const machineArticle = findArticle("manual-vs-automatic");

  const startHereItems = [
    {
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 21V10a6 6 0 0112 0v11" stroke="#8a5228" stroke-width="1.8"/><path d="M4 21h16" stroke="#8a5228" stroke-width="1.8"/></svg>`,
      title: "My shots taste sour",
      text: "Understand why it happens and how to fix it.",
      link: grindArticle,
      linkText: "Get help",
    },
    {
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 8h16l-1.5 11.5a2 2 0 01-2 1.5H7.5a2 2 0 01-2-1.5L4 8z" stroke="#8a5228" stroke-width="1.8"/><path d="M8 8V6a4 4 0 018 0v2" stroke="#8a5228" stroke-width="1.8"/></svg>`,
      title: "I want to upgrade my setup",
      text: "Find the right gear for your budget and goals.",
      link: budgetArticle,
      linkText: "See guide",
    },
    {
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#8a5228" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="#8a5228" stroke-width="1.8"/></svg>`,
      title: "I want more consistency",
      text: "Build a repeatable process for better results.",
      link: grindArticle,
      linkText: "Learn how",
    },
    {
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2v14M12 16l-4-4M12 16l4-4" stroke="#8a5228" stroke-width="1.8"/></svg>`,
      title: "I want to improve my technique",
      text: "Small changes that make a big difference.",
      link: machineArticle,
      linkText: "Explore",
    },
  ]
    .map(
      (item) => `<li class="start-item">
  <div class="start-icon">${item.icon}</div>
  <h3>${item.title}</h3>
  <p>${item.text}</p>
  <a class="start-link" href="${item.link ? item.link.data.permalink : "/"}">${item.linkText} &rarr;</a>
</li>`
    )
    .join("\n");

  const indexContent = `
<div class="hero-band">
  <section class="hero">
    <div class="hero-text">
      <span class="kicker">Home espresso, explained plainly</span>
      <h1>Buy the right gear once, not twice.</h1>
      <p class="lede">No listicles padded to 3,000 words, no fake "we tested 40 machines" claims — just the actual mechanism behind why one grinder or machine beats another, so you can stop guessing before you spend.</p>
      <a class="btn" href="#latest-guides">Explore the guides &rarr;</a>
    </div>
    <div class="hero-art">
      <svg width="200" height="200" viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M95 145 Q95 125 130 125 Q165 125 165 145 L160 190 Q158 205 140 205 L120 205 Q102 205 100 190 Z" fill="none" stroke="#e2a869" stroke-width="2.5"/>
        <ellipse cx="130" cy="145" rx="35" ry="9" fill="none" stroke="#e2a869" stroke-width="2"/>
        <path d="M165 148 Q190 148 190 168 Q190 185 168 183" fill="none" stroke="#e2a869" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M118 118 Q112 100 122 90" stroke="#c8beae" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M132 118 Q138 96 128 82" stroke="#c8beae" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.55"/>
        <path d="M146 120 Q152 104 144 92" stroke="#c8beae" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.4"/>
      </svg>
    </div>
  </section>
</div>
<section class="section" id="latest-guides">
  <div class="section-head"><h2>Latest guides</h2></div>
  <ul class="card-grid">
  ${cardItems}
  </ul>
</section>
<section class="section">
  <div class="start-here">
    <h2>New to home espresso? Start here.</h2>
    <ul class="start-grid">
    ${startHereItems}
    </ul>
  </div>
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
  fs.writeFileSync(
    path.join(OUT, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE_URL.replace(/\/$/, "")}/sitemap.xml\n`
  );
  const urls = ["/", "/about/", "/disclosure/", ...articles.map((a) => a.data.permalink)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITE_URL.replace(/\/$/, "")}${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);

  console.log(`Built ${articles.length} articles + ${standalonePages.length} pages to _site/`);
}

build();
