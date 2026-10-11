import { marked } from "marked";

export interface Article {
  title: string; slug: string; locale: string; category: string; originalUrl: string;
  author: string; date: string; tags: string[]; downloads: { title: string; url: string }[];
  credit: string; group: string; sub: string; body: string; words: number; key: string;
}

const files = import.meta.glob("./content/**/*.mdx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function parse(raw: string): { fm: Record<string, any>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, any> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    try { fm[line.slice(0, i).trim()] = JSON.parse(line.slice(i + 1).trim()); } catch { fm[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return { fm, body: m[2] };
}

const GROUPS: Record<string, string> = { comunicaciones: "Communications", communications: "Communications", articles: "Articles", blog: "Articles", ai: "AI", plc: "PLC", hmi: "HMI", scada: "SCADA", software: "Software", tools: "Tools", home: "Other" };
const SUBS: Record<string, string> = { "siemens wincc": "SIEMENS", "opc": "OPC SERVER", "control de versiones": "VERSION CONTROL", "version control": "VERSION CONTROL", "codigo generado por ia": "AI GENERATED CODE", "código generado por ia": "AI GENERATED CODE", "ai generated code": "AI GENERATED CODE", "redes industriales": "INDUSTRIAL NETWORKS", "industrial networks": "INDUSTRIAL NETWORKS", "industrial ai": "INDUSTRIAL AI" };
const grp = (c: string[]) => GROUPS[(c[1] || "").toLowerCase()] || (c[1] ? c[1] : "Other");
const sb = (c: string[]) => { const s = (c[2] || "").trim(); return SUBS[s.toLowerCase()] || s.toUpperCase() || "General"; };

export const articles: Article[] = Object.entries(files).map(([p, raw]) => {
  const { fm, body } = parse(raw);
  return {
    title: fm.title || p, slug: fm.slug || p, locale: fm.locale || "en", category: fm.category || "misc",
    originalUrl: fm.originalUrl || "", author: fm.author || "", date: fm.date || "", tags: fm.tags || [],
    downloads: fm.downloads || [], credit: fm.credit || "", group: grp(fm.breadcrumbs || []), sub: sb(fm.breadcrumbs || []), body, words: body.split(/\s+/).length,
    key: `${fm.locale || "en"}/${fm.slug || p}`,
  };
}).sort((a, b) => a.group.localeCompare(b.group) || a.sub.localeCompare(b.sub) || a.title.localeCompare(b.title, undefined, { numeric: true }));

export const render = (md: string) => marked.parse(md, { async: false }) as string;
