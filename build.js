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
  "best-espresso-grinders-under-200-uk": "/static/images/guide-grinder-lineup-v2.png",
  "burr-vs-blade-grinders": "/static/images/guide-grinder-hero-v2.png",
  "espresso-setup-budget-breakdown": "/static/images/guide-setup-budget-v2.png",
  "manual-vs-automatic-espresso": "/static/images/guide-machine-types-v2.png",
  "water-quality-espresso": "/static/images/guide-water-filter-v2.png",
};

// The gold-standard guide uses an editorial, HTML/CSS comparison rather than
// the compact legacy diagram used by the shared article template.
DIAGRAMS["burr-vs-blade"] = `<figure class="diagram grind-comparison" aria-labelledby="grind-comparison-title">
<div class="diagram-heading"><span>Visual guide</span><h3 id="grind-comparison-title">One batch. Two very different results.</h3></div>
<div class="grind-panels">
  <section class="grind-panel grind-panel--blade"><div class="grind-panel__top"><span class="grind-number">01</span><div><h4>Blade</h4><p>Chopped at random</p></div></div><div class="particles particles--mixed" aria-label="A mixture of large, medium and tiny coffee particles">● · ◉ • ⬤ · ● ◉ · ⬤ • ● · ◉</div><ul><li>Wide range of sizes</li><li>Changes from batch to batch</li><li><strong>Uneven extraction</strong></li></ul></section>
  <section class="grind-panel grind-panel--burr"><div class="grind-panel__top"><span class="grind-number">02</span><div><h4>Burr</h4><p>Crushed through a fixed gap</p></div></div><div class="particles particles--even" aria-label="Rows of consistently sized coffee particles">● ● ● ● ●<br>● ● ● ● ●<br>● ● ● ● ●</div><ul><li>Narrower range of sizes</li><li>Repeatable adjustment</li><li><strong>More even extraction</strong></li></ul></section>
</div><figcaption>The goal is not perfectly identical grounds. It is a controlled, repeatable distribution that lets water move through the coffee more evenly.</figcaption>
</figure>`;
DIAGRAMS["budget-split"] = `<figure class="diagram editorial-diagram" aria-labelledby="budget-title"><div class="diagram-heading"><span>Budget map</span><h3 id="budget-title">Give every pound a job.</h3></div><div class="diagram-cards"><section><b>50%</b><h4>Machine</h4><p>Stable temperature, pressure and steam.</p></section><section><b>40%</b><h4>Grinder</h4><p>Fine, repeatable adjustment comes first.</p></section><section><b>10%</b><h4>Essentials</h4><p>Scale, tamper and fresh coffee.</p></section></div><figcaption>A starting point, not a law. Move the split to match milk drinks, manual brewing and accessories you already own.</figcaption></figure>`;
DIAGRAMS["machine-spectrum"] = `<figure class="diagram editorial-diagram" aria-labelledby="machine-title"><div class="diagram-heading"><span>Control spectrum</span><h3 id="machine-title">How involved do you want to be?</h3></div><div class="diagram-cards"><section><b>01</b><h4>Manual</h4><p>You create pressure and control the flow.</p></section><section><b>02</b><h4>Semi-auto</h4><p>You grind, tamp and stop the shot.</p></section><section><b>03</b><h4>Super-auto</h4><p>The machine handles almost everything.</p></section></div><div class="diagram-axis"><span>More ritual</span><i></i><span>More convenience</span></div></figure>`;
DIAGRAMS["water-balance"] = `<figure class="diagram editorial-diagram" aria-labelledby="water-title"><div class="diagram-heading"><span>Water balance</span><h3 id="water-title">Too soft. Useful middle. Too hard.</h3></div><div class="diagram-cards"><section><b>&lt;50</b><h4>Too soft</h4><p>Weak extraction and flat, sour cups.</p></section><section class="is-best"><b>50–150</b><h4>Useful range</h4><p>Enough mineral for balanced extraction.</p></section><section><b>&gt;200</b><h4>Too hard</h4><p>Harsh flavour and faster scale buildup.</p></section></div><figcaption>PPM is a practical screening tool, not a complete laboratory analysis. Your machine manual and local water report still matter.</figcaption></figure>`;
const HERO_IMAGE = "/static/images/hero-espresso-setup.jpg";
const EDITORIAL_IMAGE_POOL = [
  { src: "/static/images/guide-grinder-portafilter.jpg", alt: "Prepared espresso puck and precision coffee tools", caption: "Small changes at the grinder show up clearly in the puck and the cup." },
  { src: "/static/images/guide-milk-steaming.jpg", alt: "Milk being steamed in a stainless-steel pitcher", caption: "Good milk texture comes from a controlled, repeatable technique." },
  { src: "/static/images/editorial-coffee-tools.jpg", alt: "Espresso tampers and precision coffee tools", caption: "Choose tools that make the daily workflow more consistent, not merely more elaborate." },
  { src: "/static/images/guide-water-extraction.jpg", alt: "Espresso extracting from a commercial machine", caption: "Taste is the final measurement." }
];
const ARTICLE_EDITORIAL_IMAGES = {
  "best-espresso-grinders-under-200-uk": [EDITORIAL_IMAGE_POOL[0], EDITORIAL_IMAGE_POOL[2]],
  "burr-vs-blade-grinders": [EDITORIAL_IMAGE_POOL[0], EDITORIAL_IMAGE_POOL[2]],
  "espresso-setup-budget-breakdown": [EDITORIAL_IMAGE_POOL[2], EDITORIAL_IMAGE_POOL[1]],
  "manual-vs-automatic-espresso": [EDITORIAL_IMAGE_POOL[3], EDITORIAL_IMAGE_POOL[1]],
  "water-quality-espresso": [EDITORIAL_IMAGE_POOL[3], EDITORIAL_IMAGE_POOL[2]],
};
const INLINE_ARTICLE_IMAGES = {
  "grinder-workflow": { src: "/static/images/guide-grinder-workflow-v2.png", alt: "Burr grinder dispensing freshly ground coffee into an espresso portafilter", caption: "The grinder is not a side accessory. It controls the coffee that reaches the espresso machine." },
  "burr-mechanism": { src: "/static/images/guide-burr-mechanism-v2.png", alt: "Close view inside a coffee grinder showing the metal conical burr mechanism", caption: "Inside a burr grinder, beans pass through a controlled gap between two cutting surfaces." },
  "espresso-tools": { src: "/static/images/editorial-coffee-tools.jpg", alt: "Precision espresso tools arranged beside a home coffee setup", caption: "A scale and a well-fitting tamper are small purchases that make the whole setup easier to repeat." },
  "espresso-extraction": { src: "/static/images/guide-espresso-extraction.jpg", alt: "Espresso extracting from a semi-automatic machine", caption: "Semi-automatic machines leave the final decisions in your hands while controlling temperature and pressure." },
  "milk-workflow": { src: "/static/images/guide-milk-steaming.jpg", alt: "Milk being textured with an espresso machine steam wand", caption: "Convenience is not just about the shot: consider how much of the complete drink you want the machine to handle." },
  "water-extraction": { src: "/static/images/guide-water-extraction.jpg", alt: "Fresh espresso extracting into a clear glass", caption: "Water chemistry changes what dissolves from the coffee—and therefore what reaches the cup." },
};

const ARTICLE_EDITORIAL = {
  "burr-vs-blade-grinders": { title:"Burr vs blade grinders", standfirst:"The small upgrade that can completely change your espresso.", dek:"A grinder does more than make coffee smaller. It decides whether every particle extracts together—or fights against the rest of the cup.", answer:"For espresso, buy a burr grinder. Its fixed grinding gap produces more consistent grounds, helping water extract the coffee evenly. A blade grinder chops at random, making repeatable shots much harder.", labels:["Blade","Inconsistent","Burr","Recommended"] },
  "best-espresso-grinders-under-200-uk": { title:"The best espresso grinders under £200", standfirst:"Four smart ways to spend less without wrecking the shot.", dek:"Under £200, adjustment and repeatability matter more than screens, timers or a premium-looking shell.", answer:"The Baratza Encore ESP is the best all-rounder for most UK buyers. It combines espresso-focused adjustment with repairable parts and a sensible price.", labels:["Priority","Adjustment","Avoid","Feature overload"] },
  "espresso-setup-budget-breakdown": { title:"What should a home espresso setup cost?", standfirst:"The split matters more than the total.", dek:"A balanced setup puts the grinder, machine and small essentials to work together—rather than spending everything on the biggest object.", answer:"Start close to a 50/40/10 split: roughly half for the machine, 40% for the grinder and 10% for a scale, tamper and essentials. Adjust around your workflow, not looks.", labels:["Machine","≈ 50%","Grinder","≈ 40%"] },
  "manual-vs-automatic-espresso": { title:"Manual, semi or super-automatic?", standfirst:"Choose the ritual before you choose the machine.", dek:"The best category is not the most expensive one. It is the one that matches how much control you actually want at 7am.", answer:"Unsure? Start semi-automatic. It gives you meaningful control without making every part of extraction manual, and it leaves room for your technique to improve.", labels:["More ritual","Manual","Less effort","Automatic"] },
  "water-quality-espresso": { title:"Is your tap water ruining your espresso?", standfirst:"The invisible ingredient doing two jobs at once.", dek:"Water controls both flavour extraction and scale inside the machine. Too little mineral is flat; too much is harsh and damaging.", answer:"Use filtered water as the easy default. Aim for moderate mineral content, avoid distilled water on its own, and descale on a schedule that matches local hardness.", labels:["Too soft","Flat","Too hard","Scale risk"] },
};
const ARTICLE_IMAGE_CAPTIONS = {
  "burr-vs-blade-grinders": "A consistent grind is the quiet foundation of repeatable espresso.",
  "espresso-setup-budget-breakdown": "A complete setup is a system: machine, grinder and small tools all earn their place.",
  "manual-vs-automatic-espresso": "Three machine types, three very different levels of daily involvement.",
  "water-quality-espresso": "Filtered water protects both flavour and the machine behind it.",
  "best-espresso-grinders-under-200-uk": "Under £200, workflow and adjustment matter more than cosmetic features."
};
const ARTICLE_IMAGE_ALTS = {
  "best-espresso-grinders-under-200-uk": "Three distinct home espresso burr grinders arranged for comparison",
  "burr-vs-blade-grinders": "Coffee beans inside a grinder, photographed in close detail",
  "espresso-setup-budget-breakdown": "Complete home espresso setup with machine, grinder, scale, tamper and portafilter",
  "manual-vs-automatic-espresso": "Manual lever, semi-automatic and super-automatic espresso machines arranged together",
  "water-quality-espresso": "Filtered water being poured into a home espresso machine reservoir",
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
function articleImageAlt(permalink) {
  const key = Object.keys(ARTICLE_IMAGE_ALTS).find((k) => permalink.includes(k));
  return key ? ARTICLE_IMAGE_ALTS[key] : "Home espresso equipment in use";
}
function editorialFigure(image, variant) {
  return `<figure class="editorial-figure editorial-figure--${variant}"><img src="${image.src}" alt="${image.alt}" loading="lazy"><figcaption>${image.caption}</figcaption></figure>`;
}
function weaveEditorialImages(html, permalink) {
  if (Object.keys(ARTICLE_EDITORIAL).some((slug) => permalink.includes(slug))) return html;
  const key = Object.keys(ARTICLE_EDITORIAL_IMAGES).find((slug) => permalink.includes(slug));
  const images = key ? ARTICLE_EDITORIAL_IMAGES[key] : EDITORIAL_IMAGE_POOL.slice(0, 2);
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
    const imageMarker = line.match(/^\{\{image:(.+?)\}\}$/);
    if (imageMarker) { if (inList) { html += "</ul>\n"; inList = false; } const image = INLINE_ARTICLE_IMAGES[imageMarker[1]]; if (!image) throw new Error(`Unknown image key: "${imageMarker[1]}"`); html += editorialFigure(image, "wide") + "\n"; continue; }
    const takeawayMarker = line.match(/^\{\{takeaway:\s*(.+?)\}\}$/);
    if (takeawayMarker) { if (inList) { html += "</ul>\n"; inList = false; } html += `<div class="callout"><div class="callout-label">Key takeaway</div><p>${inline(takeawayMarker[1])}</p></div>\n`; continue; }
    const pullquoteMarker = line.match(/^\{\{pullquote:\s*(.+?)\}\}$/);
    if (pullquoteMarker) { if (inList) { html += "</ul>\n"; inList = false; } html += `<blockquote class="pullquote"><p>${inline(pullquoteMarker[1])}</p></blockquote>\n`; continue; }
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
    const editorialKey = Object.keys(ARTICLE_EDITORIAL).find((slug) => article.data.permalink.includes(slug));
    const editorial = ARTICLE_EDITORIAL[editorialKey];
    const contentHtml = editorial ? `
<article class="article-page article-theme--${theme} gold-article">
  <header class="gold-hero">
    <div class="gold-hero__copy">
      <div class="breadcrumbs"><a href="/">Home</a> &nbsp;›&nbsp; <a href="/#latest-guides">Guides</a> &nbsp;›&nbsp; ${category}</div>
      <p class="article-series">The home barista's field guide <span>•</span> UK edition</p>
      <div class="article-meta"><span class="cat">${category}</span><span>${article.minutes} min read</span></div>
      <h1 class="article-title${editorial.title.length > 28 ? " article-title--long" : ""}">${editorial.title}</h1>
      <p class="gold-standfirst">${editorial.standfirst}</p>
      <p class="article-dek">${editorial.dek}</p>
      <div class="byline"><span class="byline-mark">G&amp;B</span><strong>Grind &amp; Brew</strong><span>•</span><span>${dateLabel}</span></div>
    </div>
    <figure class="gold-hero__media"><img src="${articleImage(article.data.permalink)}" alt="${articleImageAlt(article.data.permalink)}" fetchpriority="high"><figcaption><span>Field note / 01</span>${articleImageCaption(article.data.permalink)}</figcaption></figure>
  </header>
  <div class="gold-answer"><div class="gold-answer__label"><span>60-second answer</span><strong>Start here</strong></div><p><strong>${editorial.answer}</strong></p><div class="gold-answer__choice"><span>${editorial.labels[0]}</span><em>${editorial.labels[1]}</em><span>${editorial.labels[2]}</span><em>${editorial.labels[3]}</em></div></div>
  <div class="article-shell gold-shell"><div class="gold-reading-progress" aria-hidden="true"><span>01</span><i></i><span>${String(Math.max(1,article.headings.length)).padStart(2,"0")}</span></div><div class="article-layout"><div class="article-main">${article.bodyHtml}</div>${tocHtml}</div></div>
</article>` : `
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
    <div class="article-main"><figure class="article-hero-image"><div class="article-cover-frame"><img class="article-cover" src="${articleImage(article.data.permalink)}" alt="${articleImageAlt(article.data.permalink)}"><span class="article-cover-index" aria-hidden="true">G&amp;B / ${theme}</span></div><figcaption><span>Field note</span>${articleImageCaption(article.data.permalink)}</figcaption></figure>${article.bodyHtml}</div>
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
  const cardItems=articles.map((a,index)=>{ const category=a.data.category||"Guides"; const datePrefix=a.data.updated?"Reviewed":"Published"; const cardDate=a.data.updated||a.data.date; const theme=articleTheme(a.data.permalink); const number=String(index+1).padStart(2,"0"); return `<li class="card card-theme--${theme}"><a class="card-art" href="${a.data.permalink}" aria-label="Read ${escapeHtml(a.data.title)}"><img src="${articleImage(a.data.permalink)}" alt="${articleImageAlt(a.data.permalink)}" loading="lazy"><span class="card-art__wash" aria-hidden="true"></span><span class="card-art__edition">Field guide / ${number}</span><span class="card-art__subject">${category}</span></a><div class="card-body"><div class="card-cat">${category}</div><a class="card-title" href="${a.data.permalink}">${a.data.title}</a><p>${a.data.description}</p><div class="read-time">${datePrefix} ${formatArticleDate(cardDate)} · ${a.minutes} min read &nbsp;→</div></div></li>`; }).join("\n");
  const budgetArticle=findArticle("budget-breakdown"), grindArticle=findArticle("burr-vs-blade"), machineArticle=findArticle("manual-vs-automatic");
  const startHereItems=[
    {icon:"☕",title:"My shots taste sour",text:"Understand why it happens and how to fix it.",link:grindArticle,linkText:"Get help"},
    {icon:"⚙",title:"I want to upgrade my setup",text:"Find the right gear for your budget and goals.",link:budgetArticle,linkText:"See guide"},
    {icon:"◎",title:"I want more consistency",text:"Build a repeatable process for better results.",link:grindArticle,linkText:"Learn how"},
    {icon:"↗",title:"I want to improve my technique",text:"Small changes that make a big difference.",link:machineArticle,linkText:"Explore"},
  ].map((item)=>`<li class="start-item"><div class="start-icon">${item.icon}</div><h3>${item.title}</h3><p>${item.text}</p><a class="start-link" href="${item.link?item.link.data.permalink:"/"}">${item.linkText} →</a></li>`).join("\n");

  const indexContent=`
<div class="hero-shell"><section class="hero"><div class="hero-copy"><p class="kicker">Independent UK home-espresso guides</p><h1>Make better espresso at home.</h1><p class="lede">Clear advice on gear, technique and troubleshooting, with UK prices, availability and everyday kitchen realities taken into account.</p><a class="btn" href="#latest-guides">Explore the guides <span>→</span></a><p class="hero-edition">The home barista's field guide <span>•</span> UK edition</p></div><div class="hero-media"><img src="${HERO_IMAGE}" alt="Espresso machine and grinder arranged as a home coffee setup" fetchpriority="high"><span class="hero-caption">The daily ritual, considered.</span></div></section></div>
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
