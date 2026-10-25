import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { articles, render, spanishImages, type Article } from "./content";

/** Published copy of the site: images are fetched from here by the image translator */
const PUBLIC_SITE = "https://parash142433-netizen.github.io/plc-academy/";
import { GrafSim } from "./sims/GrafSim";
import { ThermalPID } from "./sims/ThermalPID";
import { ColorBatch } from "./sims/ColorBatch";

const load = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } };
const useStore = <T,>(k: string, d: T) => {
  const [v, setV] = useState<T>(() => load(k, d));
  useEffect(() => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, [k, v]);
  return [v, setV] as const;
};
const useHash = () => {
  const [h, setH] = useState(location.hash.slice(1) || "/");
  useEffect(() => { const f = () => setH(location.hash.slice(1) || "/"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
};

const GROUP_ORDER = ["PLC", "HMI", "SCADA", "Communications", "Software", "AI", "Articles", "Tools", "Other"];
const byGroupOrder = (a: string, b: string) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b);

const KEEP_UPPER = new Set(["ABB", "OPC", "AI", "GE", "IFIX", "FIX32", "MQTT", "SNMP", "PLC", "HMI", "SCADA", "CODESYS", "B&R", "COPA-DATA"]);
const SPECIAL: Record<string, string> = {
  INTOUCH: "InTouch", "OPC SERVER": "OPC servers", OTHERS: "Other", GENERAL: "General", "ZENON COPA-DATA": "zenon (COPA-DATA)",
  "BASES DE DATOS": "Databases", "AI GENERATED CODE": "AI-generated code", "VERSION CONTROL": "Version control",
  "INDUSTRIAL AI": "Industrial AI", "INDUSTRIAL NETWORKS": "Industrial networks", "GE FANUC": "GE Fanuc", "B&R AUTOMATION": "B&R Automation",
};
export const platformName = (s: string) =>
  SPECIAL[s] ?? s.split(" ").map((w) => (KEEP_UPPER.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");

type Project = { slug: string; tag: string; title: string; platform: string; summary: string; steps: number; src: string; jumps: [string, string][] };
const PROJECTS: Project[] = [
  {
    slug: "water-plant", tag: "CPU 226",
    title: "Build a water treatment PLC program",
    platform: "Siemens S7-200, CPU 226, STEP 7-Micro/WIN 4.0",
    summary: "Build the program for a water purification skid in seventeen steps, from the process and I/O list to PID loops, alarms, SCADA links and commissioning. It ends with a scan-by-scan simulator of the finished program.",
    steps: 17, src: "projects/water-plant/index.html",
    jumps: [["process", "The process and requirements"], ["io", "I/O list and hardware"], ["memory", "Memory map"], ["sequence", "Timed start sequence"],
      ["pid", "PID control"], ["alarms", "Alarms"], ["test", "Test and common mistakes"], ["simulator", "Full plant simulator"]],
  },
  {
    slug: "autoclave", tag: "CPU 226",
    title: "Basic Autoclave project: build a steam sterilizer PLC program",
    platform: "Siemens S7-200, CPU 226, STEP 7-Micro/WIN 4.0",
    summary: "Build a pre-vacuum steam sterilizer program in seventeen steps: pass-through door interlocks, vacuum pulses, pressure control on the steam table, F0, drying, and an alarm byte per fault. It ends with a simulator of the full sterilisation cycle.",
    steps: 17, src: "projects/autoclave/index.html",
    jumps: [["process", "The process and requirements"], ["start", "Start conditions and doors"], ["pulses", "Air removal: vacuum pulses"], ["control", "Pressure control and steam table"],
      ["f0", "Exposure time and F0"], ["alarms", "Alarms"], ["test", "Test and common mistakes"], ["simulator", "Sterilizer simulator"]],
  },
  {
    slug: "door-interlock", tag: "SR2A201BD",
    title: "Basic Door Interlock project: build a cleanroom door interlock",
    platform: "Schneider Zelio Logic SR2A201BD, Zelio Soft 2, ladder",
    summary: "Build a door interlock for two chains of cleanroom airlocks in thirteen steps: the interlock matrix, door-open flags, off-delay hold timers and lock outputs on 27 ladder lines. Then improve a delivered version so an emergency releases every lock at once, and test both versions in a live simulator.",
    steps: 13, src: "projects/door-interlock/index.html",
    jumps: [["process", "The rooms and requirements"], ["matrix", "The interlock matrix"], ["timers", "Interlock timers"], ["outputs", "Lock outputs"],
      ["update", "Improve a delivered program"], ["test", "Test and commission"], ["simulator", "Interlock simulator"], ["checklist", "Common mistakes"]],
  },
];

const minutes = (a: Article) => Math.max(1, Math.round(a.words / 220));
const href = (a: Article) => `#/a/${encodeURIComponent(a.key)}`;
const groupHref = (g: string) => `#/g/${encodeURIComponent(g)}`;

export default function App() {
  const hash = useHash();
  const [locale, setLocale] = useStore("locale", "en");
  const [done, setDone] = useStore<string[]>("done", []);
  const [marks, setMarks] = useStore<string[]>("bookmarks", []);
  const [recent, setRecent] = useStore<string[]>("recent", []);
  const [q, setQ] = useState("");
  const [treeOpen, setTreeOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  const locales = useMemo(() => [...new Set(articles.map((a) => a.locale))], []);
  const list = useMemo(() => articles.filter((a) => a.locale === locale), [locale]);
  const fuse = useMemo(() => new Fuse(list, { keys: [{ name: "title", weight: 3 }, "tags", "group", "sub", "body"], threshold: 0.3, ignoreLocation: true }), [list]);
  const hits = q.trim() ? fuse.search(q.trim()).slice(0, 40).map((r) => r.item) : [];

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); search.current?.focus(); search.current?.select(); }
      if (e.key === "Escape" && document.activeElement === search.current) { setQ(""); search.current?.blur(); }
    };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  }, []);

  const article = hash.startsWith("/a/") ? articles.find((a) => a.key === decodeURIComponent(hash.slice(3))) : undefined;
  const group = hash.startsWith("/g/") ? decodeURIComponent(hash.slice(3)) : undefined;

  useEffect(() => { setTreeOpen(false); setQ(""); window.scrollTo({ top: 0 }); }, [hash]);
  useEffect(() => { if (article) setRecent((r) => [article.key, ...r.filter((x) => x !== article.key)].slice(0, 8)); }, [article?.key]);
  const projMatch = hash.match(/^\/projects\/([^/]+)(?:\/([\w-]+))?$/);
  const project = projMatch ? PROJECTS.find((p) => p.slug === projMatch[1]) : undefined;

  useEffect(() => {
    document.title = article ? `${article.title} | PLC Academy` : group ? `${group} | PLC Academy` : hash === "/sims" ? "Simulators | PLC Academy"
      : project ? `${project.title} | PLC Academy` : hash === "/projects" ? "Projects | PLC Academy" : "PLC Academy";
  }, [article, group, hash, project]);

  const toggle = (arr: string[], set: (v: string[]) => void, k: string) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const section = hash === "/sims" ? "sims" : hash.startsWith("/projects") ? "projects" : "library";

  let main: React.ReactElement;
  if (q.trim()) main = <Results q={q.trim()} hits={hits} />;
  else if (hash === "/" ) main = <Home list={list} done={done} recent={recent} marks={marks} />;
  else if (hash === "/sims") main = <Sims />;
  else if (hash === "/projects") main = <ProjectIndex />;
  else if (project) main = <ProjectView p={project} step={projMatch?.[2]} />;
  else if (group && list.some((a) => a.group === group)) main = <GroupPage group={group} list={list} done={done} />;
  else if (article) main = (
    <div className="reader-layout">
      <Tree list={list} done={done} current={article} open={treeOpen} />
      <Reader a={article} list={list} done={done.includes(article.key)} marked={marks.includes(article.key)}
        onDone={() => toggle(done, setDone, article.key)} onMark={() => toggle(marks, setMarks, article.key)} />
      <Toc a={article} />
    </div>
  );
  else main = <NotFound />;

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="PLC Academy home"><Mark /><span>PLC Academy</span></a>
        <nav className="topnav" aria-label="Main">
          <a className="lib-link" href="#/" aria-current={section === "library" && !q ? "page" : undefined}>Library</a>
          <a href="#/projects" aria-current={section === "projects" && !q ? "page" : undefined}>Projects</a>
          <a href="#/sims" aria-current={section === "sims" && !q ? "page" : undefined}>Simulators</a>
        </nav>
        <div className="search" role="search">
          <label className="visually-hidden" htmlFor="q">Search articles</label>
          <input id="q" ref={search} type="search" placeholder="Search S7-1500, Modbus, WinCC…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          <kbd>Ctrl K</kbd>
        </div>
        {locales.length > 1 && (
          <select className="locale" aria-label="Language" value={locale} onChange={(e) => setLocale(e.target.value)}>
            {locales.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        )}
        {article && !q && (
          <button className="drawer-toggle" aria-expanded={treeOpen} aria-controls="library-tree" onClick={() => setTreeOpen((o) => !o)}>
            {treeOpen ? "Close" : "Contents"}
          </button>
        )}
      </header>
      <main id="main" tabIndex={-1}>{main}</main>
    </>
  );
}

function Mark() {
  // A ladder rung: rails, a normally-open contact and a coil.
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3v20M24 3v20" />
      <path d="M2 13h5M10 13h4M19.5 13h4.5" />
      <path d="M7 8v10M10 8v10" />
      <path d="M15.5 8.5a5 5 0 0 0 0 9M18 8.5a5 5 0 0 1 0 9" />
    </svg>
  );
}

/* ---------------- home ---------------- */

type Layer = { depth: number; level: string; name: string; groups: string[] };
const LAYERS: Layer[] = [
  { depth: 0, level: "IT side", name: "Data and code", groups: ["Software", "AI"] },
  { depth: 1, level: "ISA-95 level 2", name: "Supervision", groups: ["SCADA", "HMI"] },
  { depth: 2, level: "ISA-95 level 1", name: "Control", groups: ["PLC"] },
];

function Home({ list, done, recent, marks }: { list: Article[]; done: string[]; recent: string[]; marks: string[] }) {
  const stats = (g: string) => {
    const items = list.filter((a) => a.group === g);
    const subs = Object.entries(items.reduce<Record<string, number>>((m, a) => ((m[a.sub] = (m[a.sub] || 0) + 1), m), {}))
      .filter(([s]) => s !== "General").sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => platformName(s));
    return { n: items.length, read: items.filter((a) => done.includes(a.key)).length, subs };
  };
  const unit = (g: string, i: number) => {
    const s = stats(g);
    if (!s.n) return null;
    return (
      <a key={g} className="unit" href={groupHref(g)} style={{ ["--i" as string]: i }}>
        <span className="unit-top"><span className="unit-name">{g}</span><span className="unit-count">{s.n} articles</span></span>
        {s.subs.length > 0 && <span className="unit-note">{s.subs.join(", ")}</span>}
        <span className="meter" title={`${s.read} of ${s.n} read`}><i style={{ width: `${(s.read / s.n) * 100}%` }} /></span>
      </a>
    );
  };
  const comms = stats("Communications");
  const extra = ["Articles", "Tools", "Other"].filter((g) => list.some((a) => a.group === g));
  const recentArticles = recent.map((k) => articles.find((a) => a.key === k)).filter(Boolean) as Article[];
  const marked = marks.map((k) => articles.find((a) => a.key === k)).filter(Boolean) as Article[];
  let idx = 0;

  return (
    <div className="page">
      <section className="home-intro" aria-labelledby="home-title">
        <div>
          <h1 id="home-title">PLC, HMI and SCADA, layer by layer</h1>
          {list.length ? (
            <p className="lede">{list.length} tutorials you can read offline, sorted by where they sit in the plant, plus three process simulators to practise on.</p>
          ) : (
            <p className="lede">No articles yet. Run <code>npm run scrape</code> to build the library, then reload.</p>
          )}
          <div className="home-actions">
            {list.some((a) => a.group === "PLC") && <a className="btn" href={groupHref("PLC")}>Browse PLC tutorials</a>}
            <a className="btn quiet" href="#/sims">Open the simulators</a>
          </div>
          <p className="credit-line" style={{ marginTop: 28 }}>
            Articles are mirrored from <a href="https://www.plc-hmi-scadas.com/" target="_blank" rel="noreferrer">plc-hmi-scadas.com</a>; every page credits its author and links to the original.
          </p>
        </div>

        <div className="plant" role="group" aria-label="Library by plant layer">
          <div className="plant-levels">
            {LAYERS.map((l) => (
              <div className="level" data-depth={l.depth} key={l.name}>
                <div className="level-name"><b>{l.name}</b>{l.level}</div>
                <div className="level-row">{l.groups.map((g) => unit(g, idx++))}</div>
              </div>
            ))}
          </div>
          {comms.n > 0 && (
            <a className="bus" href={groupHref("Communications")} title="Networks and protocols that connect every layer">
              <small>{comms.n}</small>
              <span>Communications</span>
              <small aria-hidden="true" />
            </a>
          )}
          {extra.length > 0 && (
            <div className="plant-foot">
              {extra.map((g) => <a key={g} href={groupHref(g)}>{g === "Other" ? "Other pages" : g} ({list.filter((a) => a.group === g).length})</a>)}
            </div>
          )}
          <p className="plant-caption">Layers follow the ISA-95 model. The green line under each section is your reading progress, stored in this browser.</p>
        </div>
      </section>

      <div className="home-lower">
        <section aria-labelledby="continue-title">
          <h2 id="continue-title">Continue reading</h2>
          {recentArticles.length ? <ReadingList items={recentArticles.slice(0, 6)} done={done} /> : (
            <p className="empty">Nothing read yet. Pick a layer on the map, or press <kbd>Ctrl K</kbd> and search for a part number like S7-1200.</p>
          )}
          {marked.length > 0 && (<><h2 style={{ marginTop: 32 }}>Bookmarks</h2><ReadingList items={marked} done={done} /></>)}
        </section>
        <section aria-label="Projects and simulators">
          <h2 id="build-title">Follow a build tutorial</h2>
          <div className="faceplate-links" style={{ marginBottom: 32 }}>
            {PROJECTS.map((p) => (
              <a key={p.slug} className="faceplate-link" href={`#/projects/${p.slug}`}><span className="tag">{p.tag}</span><p><b>{p.title}</b>{p.steps} steps from process to commissioning, with a live plant simulator.</p></a>
            ))}
          </div>
          <h2 id="sim-title">Practise on a process</h2>
          <div className="faceplate-links">
            <a className="faceplate-link" href="#/sims"><span className="tag">SFC-101</span><p><b>Sequence chart</b>Step a five-stage tank batch through its GRAFCET transitions.</p></a>
            <a className="faceplate-link" href="#/sims"><span className="tag">TIC-201</span><p><b>Temperature loop</b>Tune a PID controller on a heated tank and inject disturbances.</p></a>
            <a className="faceplate-link" href="#/sims"><span className="tag">WIC-301</span><p><b>Batch dosing</b>Run an ISA-88 recipe that weighs three pigments into one tank.</p></a>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReadingList({ items, done }: { items: Article[]; done: string[] }) {
  return (
    <ul className="reading-list">
      {items.map((a) => (
        <li key={a.key}><a href={href(a)}>
          <span className="rl-title">{done.includes(a.key) && <span className="check" aria-label="Completed">✓ </span>}{a.title}</span>
          <span className="rl-path">{a.group} / {platformName(a.sub)}</span>
        </a></li>
      ))}
    </ul>
  );
}

/* ---------------- group ---------------- */

function GroupPage({ group, list, done }: { group: string; list: Article[]; done: string[] }) {
  const items = list.filter((a) => a.group === group);
  const subs = [...new Set(items.map((a) => a.sub))].sort((a, b) => (a === "General" ? 1 : b === "General" ? -1 : items.filter((x) => x.sub === b).length - items.filter((x) => x.sub === a).length));
  const read = items.filter((a) => done.includes(a.key)).length;
  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb"><a href="#/">Library</a><span aria-hidden="true">/</span><span>{group}</span></nav>
      <header className="group-head">
        <h1>{group}</h1>
        <p>{items.length} articles across {subs.length} {subs.length === 1 ? "platform" : "platforms"}. You have read {read}.</p>
      </header>
      <div className="platforms">
        {subs.map((s) => {
          const sa = items.filter((a) => a.sub === s);
          return (
            <section className="platform" key={s} aria-label={platformName(s)}>
              <h2>{platformName(s)} <small>{sa.length}</small></h2>
              <ul className="article-list">
                {sa.map((a) => (
                  <li key={a.key}><a href={href(a)}>
                    <span className="check" aria-label={done.includes(a.key) ? "Completed" : undefined}>{done.includes(a.key) ? "✓" : ""}</span>
                    <span>{a.title}</span>
                    <span className="mins">{minutes(a)} min</span>
                  </a></li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- reader ---------------- */

function Tree({ list, done, current, open }: { list: Article[]; done: string[]; current: Article; open: boolean }) {
  const groups = [...new Set(list.map((a) => a.group))].sort(byGroupOrder);
  return (
    <nav className={"tree" + (open ? " open" : "")} id="library-tree" aria-label="Library contents">
      <h2>Library</h2>
      {groups.map((g) => {
        const items = list.filter((a) => a.group === g);
        const subs = [...new Set(items.map((a) => a.sub))];
        return (
          <details key={g} open={g === current.group}>
            <summary><span>{g}</span><small>{items.length}</small></summary>
            {subs.map((s) => {
              const sa = items.filter((a) => a.sub === s);
              return (
                <details key={s} open={g === current.group && s === current.sub}>
                  <summary><span>{platformName(s)}</span><small>{sa.length}</small></summary>
                  {sa.map((a) => (
                    <a key={a.key} href={href(a)} aria-current={a.key === current.key ? "page" : undefined}>
                      {done.includes(a.key) && <span className="check" aria-label="Completed">✓</span>}{a.title}
                    </a>
                  ))}
                </details>
              );
            })}
          </details>
        );
      })}
    </nav>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The mirrored body repeats the breadcrumb, title, author and tags that the page header already shows. */
function cleanBody(a: Article) {
  let b = a.body.replace(/^\s*\[Home\][^\n]*\n+/, "").replace(/^\s*#\s+[^\n]*\n+/, "");
  if (a.author) b = b.replace(new RegExp("^\\s*" + escapeRe(a.author) + "[^\\n]*\\n+"), "");
  if (a.tags.length) b = b.replace(new RegExp("^\\s*" + escapeRe(a.tags.join(" ")) + "\\s*\\n+"), "");
  return b;
}
const slug = (t: string) => t.replace(/<[^>]+>/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Reader({ a, list, done, marked, onDone, onMark }: { a: Article; list: Article[]; done: boolean; marked: boolean; onDone(): void; onMark(): void }) {
  const body = useMemo(() => cleanBody(a), [a]);
  const html = useMemo(() => render(body).replace(/<h([23])>(.*?)<\/h\1>/g, (_m, l, t) => `<h${l} id="${slug(t)}">${t}</h${l}>`), [body]);
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    ref.current?.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".copy")) return;
      const b = document.createElement("button");
      b.className = "copy"; b.type = "button"; b.textContent = "Copy";
      b.onclick = () => {
        navigator.clipboard.writeText(pre.querySelector("code")?.textContent ?? pre.textContent ?? "").then(() => {
          b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500);
        });
      };
      pre.appendChild(b);
    });
    // Screenshots with Spanish on-screen text: keep the image as published, add an English key below it
    ref.current?.querySelectorAll("img").forEach((img) => {
      if (img.dataset.es) return;
      const m = (img.getAttribute("src") || "").match(/assets\/images\/(.+)$/);
      if (!m) return;
      let rel = m[1];
      try { rel = decodeURIComponent(rel); } catch { /* keep as is */ }
      const terms = spanishImages[rel];
      if (!terms) return;
      img.dataset.es = "1";
      const box = document.createElement("div");
      box.className = "img-es";
      const label = document.createElement("span");
      label.className = "img-es-label"; label.textContent = "Spanish on this screen: ";
      box.appendChild(label);
      terms.forEach(([es, en], i) => {
        const term = document.createElement("span");
        term.lang = "es"; term.textContent = es;
        box.append(i ? "; " : "", term, ` = ${en}`);
      });
      const url = PUBLIC_SITE + "assets/images/" + rel.split("/").map(encodeURIComponent).join("/");
      const link = document.createElement("a");
      link.href = "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(url);
      link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = "Translate the whole image";
      box.append(" ", link);
      img.insertAdjacentElement("afterend", box);
    });
  }, [html]);
  const exportMd = () => {
    const blob = new Blob([`# ${a.title}\n\n> ${a.credit}\n> Source: ${a.originalUrl}\n\n${body}`], { type: "text/markdown" });
    const l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = `${a.slug}.md`; l.click();
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const siblings = list.filter((x) => x.group === a.group && x.sub === a.sub);
  const i = siblings.findIndex((x) => x.key === a.key);
  const prev = siblings[i - 1], next = siblings[i + 1];

  return (
    <article className="doc" aria-labelledby="doc-title">
      <header className="doc-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="#/">Library</a><span aria-hidden="true">/</span>
          <a href={groupHref(a.group)}>{a.group}</a><span aria-hidden="true">/</span>
          <span>{platformName(a.sub)}</span>
        </nav>
        <h1 id="doc-title">{a.title}</h1>
        <div className="doc-meta">
          {a.author && <span>By {a.author}</span>}
          {a.date && <span>{a.date}</span>}
          <span>{minutes(a)} min read</span>
          {a.tags.length > 0 && <span>{a.tags.slice(0, 4).join(", ")}</span>}
        </div>
        <div className="doc-actions">
          <button className={"btn" + (done ? " done" : "")} onClick={onDone} aria-pressed={done}>{done ? "✓ Completed" : "Mark as completed"}</button>
          <button className="btn quiet" onClick={onMark} aria-pressed={marked}>{marked ? "Bookmarked" : "Bookmark"}</button>
          <span className="spacer" />
          <button className="linkbtn" onClick={exportMd}>{copied ? "Saved .md file" : "Save as Markdown"}</button>
          <button className="linkbtn" onClick={() => print()}>Print or save PDF</button>
        </div>
      </header>

      <dl className="source-plate">
        <dt>Source</dt><dd><a href={a.originalUrl} target="_blank" rel="noreferrer">{a.originalUrl.replace(/^https?:\/\/(www\.)?/, "")}</a></dd>
        {a.author && (<><dt>Author</dt><dd>{a.author}</dd></>)}
        <dt>Note</dt><dd>{a.note || "Mirrored for offline study. Read and cite the original where you can."}</dd>
      </dl>

      {a.downloads.length > 0 && (
        <aside className="downloads" aria-label="Downloads">
          <h2>Project files</h2>
          {a.downloads.map((d) => <div key={d.url}><a href={d.url}>{d.title}</a></div>)}
        </aside>
      )}

      <div className="prose" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />

      {(prev || next) && (
        <nav className="pager" aria-label={`More in ${platformName(a.sub)}`}>
          {prev && <a href={href(prev)}><small>Previous in {platformName(a.sub)}</small>{prev.title}</a>}
          {next && <a className="next" href={href(next)}><small>Next in {platformName(a.sub)}</small>{next.title}</a>}
        </nav>
      )}
    </article>
  );
}

function Toc({ a }: { a: Article }) {
  const items = useMemo(() => [...cleanBody(a).matchAll(/^(#{2,3})\s+(.+)$/gm)], [a]);
  if (items.length < 2) return <div />;
  return (
    <aside className="toc" aria-label="On this page">
      <h2>On this page</h2>
      {items.map((m, i) => {
        const text = m[2].replace(/[*_`]/g, "");
        return (
          <a key={i} className={m[1].length === 3 ? "sub" : undefined} href={href(a)}
            onClick={(e) => { e.preventDefault(); document.getElementById(slug(render(m[2]).replace(/<\/?p>\n?/g, "")))?.scrollIntoView(); }}>{text}</a>
        );
      })}
    </aside>
  );
}

/* ---------------- search ---------------- */

function snippet(body: string, q: string) {
  const plain = body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`|]/g, "").replace(/\s+/g, " ");
  const i = plain.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return { pre: plain.slice(0, 150), hit: "", post: "" };
  const start = Math.max(0, i - 70);
  return { pre: (start ? "…" : "") + plain.slice(start, i), hit: plain.slice(i, i + q.length), post: plain.slice(i + q.length, i + q.length + 90) + "…" };
}

function Results({ q, hits }: { q: string; hits: Article[] }) {
  return (
    <div className="page">
      <h1 style={{ fontSize: 30 }}>{hits.length ? `${hits.length === 40 ? "Top 40" : hits.length} results for “${q}”` : `No articles match “${q}”`}</h1>
      {!hits.length && <p className="empty">Try a model or protocol name, such as S7-1500, Modbus or InTouch. Press Esc to clear the search.</p>}
      <ul className="results">
        {hits.map((a) => {
          const s = snippet(a.body, q);
          return (
            <li key={a.key}><a href={href(a)}>
              <span className="r-title">{a.title}</span>
              <span className="r-path">{a.group} / {platformName(a.sub)}</span>
              <span className="r-snip">{s.pre}{s.hit && <mark>{s.hit}</mark>}{s.post}</span>
            </a></li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- projects ---------------- */

function ProjectIndex() {
  return (
    <div className="page">
      <header className="sims-head">
        <h1>Projects</h1>
        <p>Step-by-step tutorials that build complete PLC programs: the process, the design decisions, the code and how to test it. Each one ends with a simulator of the finished program.</p>
      </header>
      {PROJECTS.map((p) => (
        <article className="project-card" key={p.slug} aria-labelledby={`pj-${p.slug}`} style={{ marginBottom: 24 }}>
          <div className="project-card-main">
            <span className="tag">{p.tag}</span>
            <h2 id={`pj-${p.slug}`}><a href={`#/projects/${p.slug}`}>{p.title}</a></h2>
            <p className="muted">{p.platform}</p>
            <p>{p.summary}</p>
            <div className="home-actions">
              <a className="btn" href={`#/projects/${p.slug}`}>Start the walkthrough</a>
              <a className="btn quiet" href={`#/projects/${p.slug}/simulator`}>Go to the simulator</a>
            </div>
          </div>
          <nav className="project-jumps" aria-label={`Jump into ${p.title}`}>
            <h3>Jump to a step</h3>
            <ul>{p.jumps.map(([id, label]) => <li key={id}><a href={`#/projects/${p.slug}/${id}`}>{label}</a></li>)}</ul>
          </nav>
        </article>
      ))}
    </div>
  );
}

function ProjectView({ p, step }: { p: Project; step?: string }) {
  const src = p.src + (step ? `#${step}` : "");
  return (
    <div className="project-view">
      <div className="project-bar">
        <nav className="crumbs" aria-label="Breadcrumb"><a href="#/projects">Projects</a><span aria-hidden="true">/</span><span>{p.tag}</span></nav>
        <h1>{p.title}</h1>
        <a className="linkbtn" href={src} target="_blank" rel="noreferrer">Open on its own page</a>
      </div>
      <iframe key={src} className="project-frame" src={src} title={`${p.title}: interactive walkthrough`} />
    </div>
  );
}

/* ---------------- simulators ---------------- */

function Sims() {
  return (
    <div className="page">
      <header className="sims-head">
        <h1>Simulators</h1>
        <p>Three small processes drawn as operator faceplates. Each one runs in your browser; nothing is saved between visits.</p>
      </header>
      <GrafSim />
      <ThermalPID />
      <ColorBatch />
    </div>
  );
}

function NotFound() {
  return (
    <div className="page notfound">
      <h1>That page isn't in the library</h1>
      <p className="muted">The link may point to an article that wasn't mirrored. Search for its title, or go back to the library map.</p>
      <a className="btn" href="#/">Back to the library</a>
    </div>
  );
}
