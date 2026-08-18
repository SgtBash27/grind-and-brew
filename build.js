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

function readFile(p) { return fs.readFileSync(p, "utf8"); }

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const [, fm, body] = match;
  const data = {};
  fm.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) {
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      data[m[1]] = value;
    }
  });
  return { data, body };
}

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
  <g fill="#a8522a"><circle cx="45" cy="90" r="9"/><circle cx="80" cy="75" r="3"/><circle cx="110" cy="100" r="13"/><circle cx="150" cy="80" r="4"/><circle cx="190" cy="95" r="10"/><circle cx="230" cy="72" r="6"/><circle cx="60" cy="130" r="6"/><circle cx="100" cy="145" r="11"/><circle cx="140" cy="125" r="3"/><circle cx="180" cy="150" r="8"/><circle cx="220" cy="135" r="14"/><circle cx="250" cy="115" r="5"/><circle cx="70" cy="180" r="12"/><circle cx="115" cy="190" r="4"/><circle cx="160" cy="175" r="7"/><circle cx="200" cy="188" r="9"/><circle cx="240" cy="170" r="3"/></g>
  <g fill="#4a5d43"><circle cx="365" cy="85" r="7"/><circle cx="400" cy="85" r="7"/><circle cx="435" cy="85" r="7"/><circle cx="470" cy="85" r="7"/><circle cx="505" cy="85" r="7"/><circle cx="540" cy="85" r="7"/><circle cx="382" cy="115" r="7"/><circle cx="417" cy="115" r="7"/><circle cx="452" cy="115" r="7"/><circle cx="487" cy="115" r="7"/><circle cx="522" cy="115" r="7"/><circle cx="365" cy="145" r="7"/><circle cx="400" cy="145" r="7"/><circle cx="435" cy="145" r="7"/><circle cx="470" cy="145" r="7"/><circle cx="505" cy="145" r="7"/><circle cx="540" cy="145" r="7"/><circle cx="382" cy="175" r="7"/><circle cx="417" cy="175" r="7"/><circle cx="452" cy="175" r="7"/><circle cx="487" cy="175" r="7"/><circle cx="522" cy="175" r="7"/></g>
</svg>
<figcaption>Blade grinders chop beans into a random mix of sizes; burr grinders crush them through a fixed gap, so particle size stays consistent. That consistency is what determines whether a shot extracts evenly.</figcaption>
</figure>`,
};

const ARTICLE_IMAGES = {
  "burr-vs-blade-grinders": "https://images.unsplash.com/photo-1633276023326-4fae3e8ba556?auto=format&fit=crop&w=1400&q=82",
  "espresso-setup-budget-breakdown": "https://images.unsplash.com/photo-1774801935503-11e0cc5d8e38?auto=format&fit=crop&w=1400&q=82",
  "manual-vs-automatic-espresso": "https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=1400&q=82",
};
const HERO_IMAGE = "https://images.unsplash.com/photo-1729018711784-bd8d10d81bba?auto=format&fit=crop&w=1600&q=82";
const EDITORIAL_IMAGE_POOL = [
  { src: "https://images.unsplash.com/photo-1633276023326-4fae3e8ba556?auto=format&fit=crop&w=1200&q=84", alt: "Freshly ground coffee in espresso equipment", caption: "Small changes at the grinder show up clearly in the cup." },
  { src: "https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=1200&q=84", alt: "Espresso preparation at a coffee bar", caption: "A repeatable workflow matters more than an elaborate one." },
  { src: "https://images.unsplash.com/photo-1774801935503-11e0cc5d8e38?auto=format&fit=crop&w=1200&q=84", alt: "Home espresso equipment arranged for brewing", caption: "Build the setup around the coffee you make every day." },
  { src: "https://images.unsplash.com/photo-1729018711784-bd8d10d81bba?auto=format&fit=crop&w=1200&q=84", alt: "Espresso pouring into a cup", caption: "Taste is the final measurement." }
];
const ARTICLE_IMAGE_CAPTIONS = {
  "burr-vs-blade-grinders": "A consistent grind is the quiet foundation of repeatable espresso.",
  "espresso-setup-budget-breakdown": "Spend around the cup: grinder, water and workflow matter as much as the machine.",
  "manual-vs-automatic-espresso": "The right machine is the one whose daily ritual suits the way you actually make coffee.",
  "water-quality-espresso": "Espresso is mostly water, so what comes from the tap is never a minor detail.",
  "best-espresso-grinders-under-200-uk": "Espresso-capable grinders need fine, repeatable adjustment—not merely a fine setting."
};
// Explicit assignments keep every guide's visual identity stable across builds,
// regardless of file order or publication date changes.
const ARTICLE_THEMES = {
  "best-espresso-grinders-under-200-uk": "cream",
  "burr-vs-blade-grinders": "charcoal",
  "espresso-setup-budget-breakdown": "stone",
  "manual-vs-automatic-espresso": "coffee",
  "water-quality-espresso": "grey",
};
function articleImage(permalink) {
  const key = Object.keys(ARTICLE_IMAGES).find((k) => permalink.includes(k));
  return key ? ARTICLE_IMAGES[key] : HERO_IMAGE;
}

function slugify(text) { return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-"); }
function wordCount(text) { return text.replace(/[#*_`\[\]()>-]/g, " ").split(/\s+/).filter(Boolean).length; }
function readingTime(text) { return Math.max(1, Math.round(wordCount(text) / 200)); }

function escapeHtml(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function renderProductCard(fields) {
  const required=["badge","name","price","checked","verdict","pros","cons","url"];
  const missing=required.filter((field)=>!fields[field]);
  if (missing.length) throw new Error(`Product card for "${fields.name||"unnamed product"}" is missing: ${missing.join(", ")}`);
  if (!/^https:\/\//.test(fields.url)) throw new Error(`Product card for "${fields.name}" must use an https URL`);
  const list=(value)=>(value||"").split("|").filter(Boolean).map((item)=>`<li>${escapeHtml(item.trim())}</li>`).join("");
  return `<aside class="product-card" aria-label="${escapeHtml(fields.name)} recommendation"><p class="product-card__eyebrow">${escapeHtml(fields.badge)}</p><h3>${escapeHtml(fields.name)}</h3><p class="product-card__price">${escapeHtml(fields.price)} <span>when checked ${escapeHtml(fields.checked)}</span></p><p>${escapeHtml(fields.verdict)}</p><div class="product-card__details"><div><strong>Why it stands out</strong><ul>${list(fields.pros)}</ul></div><div><strong>Know before buying</strong><ul>${list(fields.cons)}</ul></div></div><a class="product-card__cta" href="${escapeHtml(fields.url)}" rel="noopener noreferrer">${escapeHtml(fields.cta||"Check current price")}</a><p class="product-card__link-note">Direct, non-affiliate link.</p></aside>\n`;
}
function articleTheme(permalink) {
  const key = Object.keys(ARTICLE_THEMES).find((slug) => permalink.includes(slug));
  return key ? ARTICLE_THEMES[key] : "stone";
}
function articleImageCaption(permalink) {
  const key = Object.keys(ARTICLE_IMAGE_CAPTIONS).find((k) => permalink.includes(k));
  return key ? ARTICLE_IMAGE_CAPTIONS[key] : "Better home espresso begins with careful, repeatable choices.";
}
function editorialFigure(image, variant) {
  return `<figure class="editorial-figure editorial-figure--${variant}"><img src="${image.src}" alt="${image.alt}" loading="lazy"><figcaption>${image.caption}</figcaption></figure>`;
}
function weaveEditorialImages(html, permalink) {
  const offset = Math.max(0, Object.keys(ARTICLE_IMAGE_CAPTIONS).findIndex((key) => permalink.includes(key)));
  const images = [EDITORIAL_IMAGE_POOL[(offset + 1) % EDITORIAL_IMAGE_POOL.length], EDITORIAL_IMAGE_POOL[(offset + 2) % EDITORIAL_IMAGE_POOL.length]];
  let section = 0;
  return html.replace(/(<h3\b[\s\S]*?<\/h3>\s*<p>[\s\S]*?<\/p>)/g, (match) => {
    section += 1;
    if (section === 1) return `${match}\n${editorialFigure(images[0], "portrait")}`;
    if (section === 2) return `${match}\n${editorialFigure(images[1], "wide")}`;
    return match;
  });
}

function renderMarkdown(md, headingsOut) {
  const withoutComments = md.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutComments.split("\n");
  let html = "";
  let inList = false;
  function inline(text) { return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>'); }
  for (let lineIndex=0; lineIndex<lines.length; lineIndex+=1) {
    const rawLine=lines[lineIndex];
    const line = rawLine.trim();
    if (line === ":::product") { if (inList) { html += "</ul>\n"; inList=false; } const fields={}; lineIndex+=1; while (lineIndex<lines.length && lines[lineIndex].trim()!==":::") { const field=lines[lineIndex].trim().match(/^([a-z]+):\s*(.*)$/i); if (field) fields[field[1].toLowerCase()]=field[2].trim(); lineIndex+=1; } html+=renderProductCard(fields); continue; }
    if (line === "") { if (inList) { html += "</ul>\n"; inList = false; } continue; }
    const diagramMarker = line.match(/^\{\{diagram:(.+?)\}\}$/);
    if (diagramMarker) { if (inList) { html += "</ul>\n"; inList = false; } const diagram = DIAGRAMS[diagramMarker[1]]; if (!diagram) throw new Error(`Unknown diagram key: "${diagramMarker[1]}"`); html += diagram + "\n"; continue; }
    const takeawayMarker = line.match(/^\{\{takeaway:\s*(.+?)\}\}$/);
    if (takeawayMarker) { if (inList) { html += "</ul>\n"; inList = false; } html += `<div class="callout"><div class="callout-label">Key takeaway</div><p>${inline(takeawayMarker[1])}</p></div>\n`; continue; }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) { if (inList) { html += "</ul>\n"; inList = false; } const level = heading[1].length + 1; const text = inline(heading[2]); const id = slugify(heading[2]); if (headingsOut) headingsOut.push({ text: heading[2], id }); html += `<h${level} id="${id}">${text}</h${level}>\n`; continue; }
    const listItem = line.match(/^-\s+(.*)$/);
    if (listItem) { if (!inList) { html += "<ul>\n"; inList = true; } html += `<li>${inline(listItem[1])}</li>\n`; continue; }
    if (inList) { html += "</ul>\n"; inList = false; }
    html += `<p>${inline(line)}</p>\n`;
  }
  if (inList) html += "</ul>\n";
  return html;
}

function renderPage(template, vars) { let out = template; for (const [key, value] of Object.entries(vars)) out = out.split(`{{${key}}}`).join(value); return out; }
function articleSchema({ title, description, permalink, date, updated }) { const schema={ "@context":"https://schema.org", "@type":"Article", headline:title, description, url:SITE_URL.replace(/\/$/,"")+permalink, datePublished:date, author:{"@type":"Organization",name:"Grind & Brew"} }; if (updated) schema.dateModified=updated; return JSON.stringify(schema); }
function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year,month,day]=value.split("-").map(Number);
  const parsed=new Date(Date.UTC(year,month-1,day));
  return parsed.getUTCFullYear()===year && parsed.getUTCMonth()===month-1 && parsed.getUTCDate()===day;
}
function validateArticleData(data, file) {
  for (const field of ["title","description","date","permalink"]) if (!data[field]) throw new Error(`${file}: missing required frontmatter field "${field}"`);
  if (!isIsoDate(data.date)) throw new Error(`${file}: date must use YYYY-MM-DD`);
  if (data.updated && !isIsoDate(data.updated)) throw new Error(`${file}: updated must use YYYY-MM-DD`);
  if (data.updated && data.updated < data.date) throw new Error(`${file}: updated cannot be earlier than date`);
  if (!/^\/guides\/.+\/$/.test(data.permalink)) throw new Error(`${file}: guide permalink must start with /guides/ and end with /`);
}
function formatArticleDate(date) { const parsed=new Date(`${date}T12:00:00Z`); if (Number.isNaN(parsed.getTime())) return date; return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(parsed); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writePage(outPath, html) { ensureDir(path.dirname(outPath)); fs.writeFileSync(outPath, html); }
function copyDir(srcDir, outDir) { ensureDir(outDir); for (const entry of fs.readdirSync(srcDir,{withFileTypes:true})) { const s=path.join(srcDir,entry.name); const o=path.join(outDir,entry.name); if (entry.isDirectory()) copyDir(s,o); else fs.copyFileSync(s,o); } }

function build() {
  const template = readFile(path.join(SRC, "_includes", "base.html"));
  const articlesDir = path.join(SRC, "articles");
  const articleFiles = fs.existsSync(articlesDir) ? fs.readdirSync(articlesDir).filter((f)=>f.endsWith(".md")) : [];
  const articles = articleFiles.map((file)=>{ const raw=readFile(path.join(articlesDir,file)); const {data,body}=parseFrontmatter(raw); validateArticleData(data,file); const headings=[]; const bodyHtml=weaveEditorialImages(renderMarkdown(body,headings),data.permalink); return {data,bodyHtml,headings,minutes:readingTime(body)}; });
  articles.sort((a,b)=>(a.data.date < b.data.date ? 1 : -1));

  for (const article of articles) {
    const category = article.data.category || "Guides";
    const dateLabel = article.data.updated ? `Updated ${formatArticleDate(article.data.updated)}` : `Published ${formatArticleDate(article.data.date)}`;
    const tocHtml = article.headings.length ? `<aside class="article-toc"><div class="toc-label">On this page</div><ul>${article.headings.map((h)=>`<li><a href="#${h.id}">${h.text}</a></li>`).join("")}</ul></aside>` : "";
    const theme = articleTheme(article.data.permalink);
    const contentHtml = `
<article class="article-page article-theme--${theme}">
<div class="article-shell">
  <div class="breadcrumbs"><a href="/">Home</a> &nbsp;›&nbsp; <a href="/#latest-guides">Guides</a> &nbsp;›&nbsp; ${category}</div>
  <header class="article-head">
    <p class="article-series">The home barista's field guide <span>•</span> Grind &amp; Brew</p>
    <div class="article-meta"><span class="cat">${category}</span><span>${article.minutes} min read</span></div>
    <h1 class="article-title">${article.data.title}</h1>
    <p class="article-dek">${article.data.description || ""}</p>
    <div class="byline"><span class="byline-mark">◌</span><strong>By Grind &amp; Brew</strong><span>•</span><span>${dateLabel}</span></div>
  </header>
  <div class="article-layout">
    <div class="article-main"><figure class="article-hero-image"><img class="article-cover" src="${articleImage(article.data.permalink)}" alt="Espresso and coffee equipment"><figcaption><span>Field note</span>${articleImageCaption(article.data.permalink)}</figcaption></figure>${article.bodyHtml}</div>
    ${tocHtml}
  </div>
</div>
</article>`;
    const canonical = SITE_URL.replace(/\/$/, "") + article.data.permalink;
    const page = renderPage(template,{title:article.data.title,description:article.data.description||"",content:contentHtml,canonical,schema:`<script type="application/ld+json">${articleSchema(article.data)}</script>`});
    const permalink=article.data.permalink.replace(/^\/|\/$/g,""); writePage(path.join(OUT,permalink,"index.html"),page);
  }

  for (const file of ["about.md","disclosure.md"]) {
    const raw=readFile(path.join(SRC,file)); const {data,body}=parseFrontmatter(raw);
    const contentHtml=`<div class="page-shell"><h1 class="article-title">${data.title}</h1><div class="article-main">${renderMarkdown(body)}</div></div>`;
    const canonical=SITE_URL.replace(/\/$/,"")+data.permalink;
    const page=renderPage(template,{title:data.title,description:data.description||"",content:contentHtml,canonical,schema:""});
    writePage(path.join(OUT,data.permalink.replace(/^\/|\/$/g,""),"index.html"),page);
  }

  const findArticle=(slugPart)=>articles.find((a)=>a.data.permalink.includes(slugPart));
  const cardItems=articles.map((a)=>{ const category=a.data.category||"Guides"; const datePrefix=a.data.updated?"Reviewed":"Published"; const cardDate=a.data.updated||a.data.date; return `<li class="card"><div class="card-art"><img src="${articleImage(a.data.permalink)}" alt="Coffee equipment and brewing setup" loading="lazy"></div><div class="card-body"><div class="card-cat">${category}</div><a class="card-title" href="${a.data.permalink}">${a.data.title}</a><p>${a.data.description}</p><div class="read-time">${datePrefix} ${formatArticleDate(cardDate)} · ${a.minutes} min read &nbsp;→</div></div></li>`; }).join("\n");
  const budgetArticle=findArticle("budget-breakdown"), grindArticle=findArticle("burr-vs-blade"), machineArticle=findArticle("manual-vs-automatic");
  const startHereItems=[
    {icon:"☕",title:"My shots taste sour",text:"Understand why it happens and how to fix it.",link:grindArticle,linkText:"Get help"},
    {icon:"⚙",title:"I want to upgrade my setup",text:"Find the right gear for your budget and goals.",link:budgetArticle,linkText:"See guide"},
    {icon:"◎",title:"I want more consistency",text:"Build a repeatable process for better results.",link:grindArticle,linkText:"Learn how"},
    {icon:"↗",title:"I want to improve my technique",text:"Small changes that make a big difference.",link:machineArticle,linkText:"Explore"},
  ].map((item)=>`<li class="start-item"><div class="start-icon">${item.icon}</div><h3>${item.title}</h3><p>${item.text}</p><a class="start-link" href="${item.link?item.link.data.permalink:"/"}">${item.linkText} →</a></li>`).join("\n");

  const indexContent=`
<div class="hero-shell"><section class="hero"><div class="hero-copy"><p class="kicker">Independent UK home-espresso guides</p><h1>Make better espresso at home.</h1><p class="lede">Clear advice on gear, technique and troubleshooting, with UK prices, availability and everyday kitchen realities taken into account.</p><a class="btn" href="#latest-guides">Explore the guides <span>→</span></a><p class="hero-edition">The home barista's field guide <span>•</span> UK edition</p></div><div class="hero-media"><img src="${HERO_IMAGE}" alt="Espresso pouring into a glass" fetchpriority="high"><span class="hero-caption">The daily ritual, considered.</span></div></section></div>
<section class="uk-context" aria-label="How Grind and Brew helps UK readers"><div><strong>UK buying context</strong><span>Prices in pounds, UK stock and warranties checked where they affect a recommendation.</span></div><div><strong>Evidence, not theatre</strong><span>Manufacturer documents, credible independent testing and owner evidence — never invented hands-on claims.</span></div><div><strong>Advice that travels</strong><span>The brewing principles stay useful wherever you live; the shopping detail is localised for Britain.</span></div></section>
<section class="section" id="latest-guides"><div class="section-head"><h2>Latest guides</h2><a href="#latest-guides">View all →</a></div><ul class="card-grid">${cardItems}</ul></section>
<section class="section"><div class="start-here"><h2>New to home espresso? Start here.</h2><ul class="start-grid">${startHereItems}</ul></div></section>
<section class="section methodology"><p class="kicker">How recommendations work</p><h2>Research-led, with the limits stated plainly.</h2><p>We compare the things that matter in a UK purchase: usable performance, current pricing and stock, warranty and parts support, then cross-check manufacturer claims against credible independent testing and longer-term owner evidence. When we have not personally tested a product, we say so.</p><a class="text-link" href="/about/#our-research-method">Read our research method →</a></section>`;
  const indexPage=renderPage(template,{title:"UK Home Espresso Guides",description:"Independent home espresso guides with UK prices, availability and context, built from transparent evidence rather than invented hands-on claims.",content:indexContent,canonical:SITE_URL.replace(/\/$/,"")+"/",schema:""});
  writePage(path.join(OUT,"index.html"),indexPage);

  copyDir(path.join(SRC,"static"),path.join(OUT,"static"));
  const siteUrl=SITE_URL.replace(/\/$/,"");
  fs.writeFileSync(path.join(OUT,"robots.txt"),`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
  const urls=[{path:"/"},{path:"/about/"},{path:"/disclosure/"},...articles.map((a)=>({path:a.data.permalink,lastmod:a.data.updated||a.data.date}))];
  const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u)=>`  <url><loc>${siteUrl}${u.path}</loc>${u.lastmod?`<lastmod>${u.lastmod}</lastmod>`:""}</url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(OUT,"sitemap.xml"),sitemap);
  console.log(`Built ${articles.length} articles + 2 pages to _site/`);
}

if (require.main === module) build();

module.exports = { build, isIsoDate, validateArticleData };
