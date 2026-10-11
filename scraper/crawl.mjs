// Offline-study mirror crawler for plc-hmi-scadas.com.
// Run: npm i && npx playwright install chromium && npm run scrape
// Respects robots.txt, throttles requests, and keeps author + original-URL credit in every file.
import { chromium } from "playwright";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import fs from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://www.plc-hmi-scadas.com";
const CONTENT = path.resolve("src/content");
const ASSETS = path.resolve("public/assets/images");
const MAX = Number(process.env.MAX_PAGES || Infinity);
const CONCURRENCY = 4, DELAY = 250, RETRIES = 3;
const SEEDS = ["/en/Home/", "/en/PLC/", "/en/HMI/", "/en/SCADA/", "/en/Library/", "/en/Tools/", "/es/"];
// If the site's DOM differs, adjust: first matching selector wins.
const BODY_SELECTORS = ["article", "main .content", "#content", "main"];
const JUNK = "nav,header,footer,aside,script,style,noscript,.sidebar,.ad,.ads,[class*=cookie],[class*=banner]";
const FILE_EXT = /\.(zip|zap\d*|pdf|7z|rar|scl|xml|json)$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "index";
const q = (v) => JSON.stringify(v);
const pathSlugs = (p) => p.replace(/\.(php|html?)$/i, "").split("/").filter(Boolean).slice(1).map(slugify);

async function loadRobots() {
  try {
    const txt = await (await fetch(ORIGIN + "/robots.txt")).text();
    const rules = []; let applies = false;
    for (const line of txt.split(/\r?\n/)) {
      const [k, ...rest] = line.split(":"); const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*";
      else if (applies && /^disallow$/i.test(k) && v) rules.push(v);
    }
    return (p) => !rules.some((r) => p.startsWith(r));
  } catch { return () => true; }
}

const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
td.addRule("fencedPre", {
  filter: "pre",
  replacement(_c, node) {
    const code = node.textContent ?? "";
    const cls = node.querySelector("code")?.getAttribute("class") || node.getAttribute("class") || "";
    let lang = (cls.match(/(?:language|lang)-([\w+#-]+)/) || [])[1] || "";
    if (!lang && /\b(FUNCTION_BLOCK|VAR_INPUT|END_IF|THEN)\b|:=/.test(code)) lang = "iecst";
    return `\n\n\`\`\`${lang}\n${code.replace(/\n$/, "")}\n\`\`\`\n\n`;
  },
});

async function retry(fn) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= RETRIES) throw e; await sleep(1000 * i); }
  }
}

async function downloadImage(url, slug) {
  try {
    const res = await retry(() => fetch(url));
    if (!res.ok) return null;
    const raw = path.basename(new URL(url).pathname) || "img";
    let name = raw;
    try { name = decodeURIComponent(raw); } catch {}
    name = name.replace(/[<>:"/\\|?*]/g, "_"); // keep the file name the same as what the browser will request
    const dir = path.join(ASSETS, slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
    return `./assets/images/${slug}/${name}`;
  } catch { return null; }
}

function extract(html, url) {
  const $ = cheerio.load(html);
  const meta = (n) => $(`meta[name="${n}"],meta[property="${n}"]`).attr("content") || "";
  const title = ($("h1").first().text() || $("title").text()).trim();
  const author = meta("author") || $('[rel=author],.author,[class*=author]').first().text().trim();
  const date = (meta("article:published_time") || $("time").first().attr("datetime") || "").slice(0, 10);
  const crumbs = $('[class*=breadcrumb] a, nav[aria-label*=readcrumb] a').map((_, a) => $(a).text().trim()).get();
  const tags = $('[rel=tag],.tag,.tags a').map((_, a) => $(a).text().trim()).get();
  let $body = null;
  for (const s of BODY_SELECTORS) { const el = $(s).first(); if (el.length) { $body = el; break; } }
  if (!$body) return null;
  $body.find(JUNK).remove();
  const downloads = [];
  $body.find("a[href]").each((_, a) => {
    const href = new URL($(a).attr("href"), url).href;
    if (FILE_EXT.test(new URL(href).pathname)) downloads.push({ title: $(a).text().trim() || path.basename(href), url: href });
  });
  const images = [];
  $body.find("img[src]").each((_, img) => images.push(new URL($(img).attr("src"), url).href));
  const links = $("a[href]").map((_, a) => { try { return new URL($(a).attr("href"), url).href.split("#")[0]; } catch { return null; } }).get().filter(Boolean);
  return { title, author, date, crumbs, tags, downloads, images, links, bodyHtml: $.html($body) };
}

async function main() {
  const allowed = await loadRobots();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: "PLC-Academy-OfflineMirror/0.1 (personal educational use)" });
  const seen = new Set(), queue = [], index = [];
  let active = 0;
  const enqueue = (u) => {
    const x = new URL(u);
    if (x.origin !== ORIGIN || !/^\/(en|es)(\/|$)/i.test(x.pathname) || !allowed(x.pathname)) return;
    x.hash = ""; const k = x.href;
    if (!seen.has(k) && !FILE_EXT.test(x.pathname)) { seen.add(k); queue.push(k); }
  };
  SEEDS.forEach((s) => enqueue(ORIGIN + s));

  async function worker() {
    while (true) {
      const url = index.length >= MAX ? undefined : queue.shift();
      if (!url) { if (active === 0) return; await sleep(300); continue; }
      active++;
      await sleep(DELAY);
      const page = await ctx.newPage();
      try {
        await retry(() => page.goto(url, { waitUntil: "networkidle", timeout: 45000 }));
        const data = extract(await page.content(), url);
        if (!data) continue;
        data.links.forEach(enqueue);
        const locale = new URL(url).pathname.toLowerCase().startsWith("/es") ? "es" : "en";
        const segs = pathSlugs(new URL(url).pathname);
        const slug = segs.join("-") || "index";
        const category = slugify(data.crumbs[1] || data.crumbs[0] || segs[0] || "home");
        const $b = cheerio.load(data.bodyHtml, null, false);
        for (const el of $b("img[src]").toArray()) {
          const local = await downloadImage(new URL($b(el).attr("src"), url).href, slug);
          if (local) $b(el).attr("src", local);
        }
        $b("a[href]").each((_, a) => {
          try {
            const u = new URL($b(a).attr("href"), url);
            if (u.origin === ORIGIN && /^\/(en|es)\//i.test(u.pathname) && !FILE_EXT.test(u.pathname)) {
              const s = pathSlugs(u.pathname).join("-") || "index";
              $b(a).attr("href", `#/a/${encodeURIComponent(u.pathname.split("/")[1].toLowerCase() + "/" + s)}`);
            } else $b(a).attr("href", u.href);
          } catch {}
        });
        let md = td.turndown($b.html());
        const words = md.split(/\s+/).length;
        if (words < 60 && !data.title) continue; // skip hub/empty pages
        const fm = [
          "---",
          `title: ${q(data.title)}`, `slug: ${q(slug)}`, `locale: ${q(locale)}`, `category: ${q(category)}`,
          `originalUrl: ${q(url)}`, `author: ${q(data.author)}`, `date: ${q(data.date)}`,
          `breadcrumbs: ${q(data.crumbs)}`, `tags: ${q(data.tags)}`, `downloads: ${q(data.downloads)}`,
          `credit: ${q(`Original content (c) its authors at ${ORIGIN}. Mirrored offline for personal study; see originalUrl.`)}`,
          "---", "",
        ].join("\n");
        const dir = path.join(CONTENT, locale, category);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, `${slug}.mdx`), fm + md + `\n\n---\n*Source: [${data.title}](${url})${data.author ? ` — ${data.author}` : ""}*\n`);
        index.push({ locale, category, slug, title: data.title, words, url });
        console.log(`[${index.length}] ${url}`);
      } catch (e) {
        console.error("FAIL", url, e.message);
      } finally { await page.close(); active--; }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await fs.writeFile(path.join(CONTENT, "curriculum-index.json"), JSON.stringify(index, null, 2));
  await browser.close();
  console.log(`Done: ${index.length} pages`);
}
main();
