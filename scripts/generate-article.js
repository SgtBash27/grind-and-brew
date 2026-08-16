#!/usr/bin/env node
/**
 * Pulls the next "pending" topic from topics-queue.json, asks the
 * Anthropic API to draft it as a real article (same quality bar as the
 * hand-written launch articles), writes it to src/articles/, marks the
 * topic "published" in the queue, and exits non-zero if anything looks
 * wrong so the workflow fails loudly instead of publishing something bad.
 *
 * Requires: ANTHROPIC_API_KEY env var (set as a GitHub Actions repo secret).
 * Deliberately does NOT auto-invent specific product names/prices/affiliate
 * links — it leaves the same AFFILIATE LINK PLACEHOLDER comment pattern
 * the launch articles use, so nothing goes live with fabricated product
 * claims. A human fills those in before (or after) the article ships.
 */
const fs = require("fs");
const path = require("path");

const QUEUE_PATH = path.join(__dirname, "..", "topics-queue.json");
const ARTICLES_DIR = path.join(__dirname, "..", "src", "articles");
const MODEL = process.env.CONTENT_MODEL || "claude-sonnet-4-5-20250929";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. Add it as a GitHub Actions repo secret.");
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
  const next = queue.topics.find((t) => t.status === "pending");
  if (!next) {
    console.log("No pending topics in queue. Nothing to do — add more topics to topics-queue.json.");
    return;
  }

  const systemPrompt = `You write for Grind & Brew, a small home-espresso guide site. House style:
- Genuine mechanical/practical explanation, not generic listicle filler.
- No invented statistics, no fake "we tested X products" claims.
- No specific product names, models, or prices — instead include exactly one
  HTML comment placeholder in this exact form at the end:
  <!-- AFFILIATE LINK PLACEHOLDER: [describe what should be linked here] -->
- 600-900 words. Plain markdown: # for the title (used once, matching the
  given title), ## and ### for subheadings, **bold** sparingly, [text](url)
  only for internal links to other guides (not external/affiliate links).
- Confident, direct tone. No em-dash-laden AI-listicle voice, no "in
  conclusion", no filler introductions.
- Output ONLY the markdown body (no frontmatter, no title line duplicated
  outside the single # heading).`;

  const userPrompt = `Title: ${next.title}\nBrief: ${next.brief}\n\nWrite the full article now.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Anthropic API error ${res.status}: ${errText}`);
    process.exit(1);
  }

  const data = await res.json();
  const body = data.content && data.content[0] && data.content[0].text;
  if (!body || body.length < 200) {
    console.error("Generated content looked too short or empty — refusing to publish.");
    process.exit(1);
  }

  const date = todayISO();
  const permalink = `/guides/${next.slug}/`;
  const frontmatter = [
    "---",
    "layout: base.html",
    `title: "${next.title.replace(/"/g, '\\"')}"`,
    `description: "${next.brief.replace(/"/g, '\\"').slice(0, 150)}"`,
    `date: ${date}`,
    `permalink: ${permalink}`,
    "---",
    "",
  ].join("\n");

  const outPath = path.join(ARTICLES_DIR, `${next.slug}.md`);
  fs.writeFileSync(outPath, frontmatter + body.trim() + "\n");

  next.status = "published";
  next.publishedDate = date;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n");

  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
