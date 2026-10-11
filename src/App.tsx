import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { articles, render, type Article } from "./content";
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

export default function App() {
  const hash = useHash();
  const [locale, setLocale] = useStore("locale", "en");
  const [done, setDone] = useStore<string[]>("done", []);
  const [marks, setMarks] = useStore<string[]>("bookmarks", []);
  const [recent, setRecent] = useStore<string[]>("recent", []);
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const list = useMemo(() => articles.filter((a) => a.locale === locale), [locale]);
  const fuse = useMemo(() => new Fuse(list, { keys: ["title", "tags", "group", "sub", "body"], threshold: 0.3, ignoreLocation: true }), [list]);
  const hits = q ? fuse.search(q).slice(0, 30).map((r) => r.item) : [];

  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); search.current?.focus(); } };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  }, []);

  const article = hash.startsWith("/a/") ? articles.find((a) => a.key === decodeURIComponent(hash.slice(3))) : undefined;
  useEffect(() => { if (article) setRecent((r) => [article.key, ...r.filter((x) => x !== article.key)].slice(0, 8)); }, [article?.key]);
  const toggle = (arr: string[], set: (v: string[]) => void, k: string) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  return (
    <>
      <header>
        <a href="#/"><b>PLC Academy</b></a>
        <a href="#/sims">Simulators</a>
        <input ref={search} placeholder="Search (Ctrl+K)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={locale} onChange={(e) => setLocale(e.target.value)}><option value="en">EN</option><option value="es">ES</option></select>
      </header>
      {q ? (
        <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
          <div>{hits.length === 0 && <p>No results.</p>}{hits.map((a) => (
            <div className="card" key={a.key}><a href={`#/a/${encodeURIComponent(a.key)}`} onClick={() => setQ("")}>{a.title}</a> <small>{a.group} · {a.sub}</small></div>))}</div>
        </div>
      ) : hash === "/sims" ? (
        <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
          <GrafSim /><ThermalPID /><ColorBatch />
        </div>
      ) : (
        <div className="layout">
          <Tree list={list} done={done} current={article?.key} />
          {article ? <Reader a={article} done={done.includes(article.key)} marked={marks.includes(article.key)}
            onDone={() => toggle(done, setDone, article.key)} onMark={() => toggle(marks, setMarks, article.key)} />
            : <Dashboard list={list} done={done} marks={marks} recent={recent} />}
          {article && <Toc a={article} />}
        </div>
      )}
    </>
  );
}

function Tree({ list, done, current }: { list: Article[]; done: string[]; current?: string }) {
  const groups = [...new Set(list.map((a) => a.group))];
  return (
    <nav className="tree">
      {groups.map((g) => {
        const items = list.filter((a) => a.group === g);
        const subs = [...new Set(items.map((a) => a.sub))];
        return (
          <details key={g} open={items.some((a) => a.key === current)}>
            <summary>{g} ({items.length})</summary>
            {subs.map((s) => {
              const sa = items.filter((a) => a.sub === s);
              return (
                <details key={s} style={{ marginLeft: 8 }} open={sa.some((a) => a.key === current)}>
                  <summary style={{ fontWeight: 500 }}>{s} ({sa.length})</summary>
                  {sa.map((a) => <a key={a.key} className={a.key === current ? "on" : ""} href={`#/a/${encodeURIComponent(a.key)}`}>{done.includes(a.key) ? "✓ " : ""}{a.title}</a>)}
                </details>);
            })}
          </details>);
      })}
      {!list.length && <p>No content yet. Run <code>npm run scrape</code>.</p>}
    </nav>
  );
}

function Dashboard({ list, done, marks, recent }: { list: Article[]; done: string[]; marks: string[]; recent: string[] }) {
  const cats = [...new Set(list.map((a) => a.group))];
  const link = (k: string) => { const a = articles.find((x) => x.key === k); return a && <div key={k}><a href={`#/a/${encodeURIComponent(k)}`}>{a.title}</a></div>; };
  return (
    <div>
      <h1>Dashboard</h1>
      {cats.map((c) => { const t = list.filter((a) => a.group === c), d = t.filter((a) => done.includes(a.key)).length;
        return <div className="card" key={c}>{c}: {d}/{t.length}<div className="bar"><i style={{ width: `${(d / t.length) * 100}%` }} /></div></div>; })}
      <h3>Recently read</h3>{recent.map(link)}<h3>Bookmarks</h3>{marks.map(link)}
    </div>
  );
}

function Reader({ a, done, marked, onDone, onMark }: { a: Article; done: boolean; marked: boolean; onDone(): void; onMark(): void }) {
  const html = useMemo(() => render(a.body).replace(/<h([23])>(.*?)<\/h\1>/g, (_m, l, t) => `<h${l} id="${slug(t)}">${t}</h${l}>`), [a]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector("button")) return;
      const b = document.createElement("button"); b.textContent = "Copy"; b.className = "btn ghost"; b.style.cssText = "position:absolute;top:6px;right:6px";
      b.onclick = () => navigator.clipboard.writeText(pre.textContent?.replace(/^Copy/, "") || ""); pre.appendChild(b);
    });
  }, [html]);
  const exportMd = () => {
    const blob = new Blob([`# ${a.title}\n\n> ${a.credit}\n> Source: ${a.originalUrl}\n\n${a.body}`], { type: "text/markdown" });
    const l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = `${a.slug}.md`; l.click();
  };
  return (
    <article className="doc">
      <h1>{a.title}</h1>
      <div className="credit">{a.author && <>By {a.author}. </>}{a.date}<br />{a.credit} <a href={a.originalUrl} target="_blank" rel="noreferrer">Original</a></div>
      <div className="row">
        <button className="btn" onClick={onDone}>{done ? "✓ Completed" : "Mark as completed"}</button>
        <button className="btn ghost" onClick={onMark}>{marked ? "★ Bookmarked" : "☆ Bookmark"}</button>
        <button className="btn ghost" onClick={exportMd}>Export .md</button>
        <button className="btn ghost" onClick={() => print()}>Print / PDF</button>
        <span>~{Math.max(1, Math.round(a.words / 200))} min</span>
      </div>
      {a.downloads.length > 0 && <div className="card"><b>Downloads</b>{a.downloads.map((d) => <div key={d.url}><a href={d.url}>{d.title}</a></div>)}</div>}
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

const slug = (t: string) => t.replace(/<[^>]+>/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
function Toc({ a }: { a: Article }) {
  const items = [...a.body.matchAll(/^(#{2,3})\s+(.+)$/gm)];
  return <aside className="toc"><b>On this page</b>{items.map((m, i) => <a key={i} style={{ paddingLeft: (m[1].length - 2) * 12 }} href={`#/a/${encodeURIComponent(a.key)}`}
    onClick={(e) => { e.preventDefault(); document.getElementById(slug(m[2]))?.scrollIntoView({ behavior: "smooth" }); }}>{m[2]}</a>)}</aside>;
}
