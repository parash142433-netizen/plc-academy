import { useEffect, useRef, useState } from "react";

type State = "Idle" | "Running" | "Paused" | "Complete" | "Aborted";
const STATES: State[] = ["Idle", "Running", "Paused", "Complete", "Aborted"];
const COMP = [
  { n: "Red", tag: "XV-11", c: [196, 52, 44] },
  { n: "Green", tag: "XV-12", c: [52, 140, 84] },
  { n: "Blue", tag: "XV-13", c: [48, 98, 168] },
];
const RECIPES: Record<string, number[]> = { "Recipe A": [30, 50, 20], "Recipe B": [10, 20, 70] };
const RATE = 4;   // kg/s through an open valve
const TOL = 0.5;  // kg

export function ColorBatch() {
  const [state, setState] = useState<State>("Idle");
  const [rec, setRec] = useState("Recipe A");
  const [dosed, setDosed] = useState([0, 0, 0]);
  const [tare, setTare] = useState(0);
  const st = useRef({ state, dosed, rec });
  st.current = { state, dosed, rec };
  const target = RECIPES[rec];
  const active = state === "Running" ? dosed.findIndex((d, i) => d < target[i]) : -1;

  useEffect(() => {
    const id = setInterval(() => {
      const { state, dosed, rec } = st.current;
      if (state !== "Running") return;
      const i = dosed.findIndex((d, k) => d < RECIPES[rec][k]);
      if (i < 0) return setState("Complete");
      setDosed((d) => d.map((v, k) => (k === i ? Math.min(RECIPES[rec][k], +(v + RATE * 0.1).toFixed(2)) : v)));
    }, 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (state === "Running" && dosed.every((d, i) => d >= target[i])) setState("Complete"); }, [dosed, state]);

  const gross = dosed.reduce((a, b) => a + b, 0);
  const total = gross || 1;
  const mix = COMP.reduce((a, c, i) => a.map((v, k) => v + (c.c[k] * dosed[i]) / total), [0, 0, 0]).map(Math.round);
  const level = Math.min(1, gross / 100);
  const reset = () => { setDosed([0, 0, 0]); setState("Idle"); };
  const outOfTol = (i: number) => state === "Complete" && Math.abs(dosed[i] - target[i]) > TOL;
  const H = 180, fillH = H * level;

  return (
    <section className="faceplate" aria-labelledby="wic-title">
      <div className="fp-head">
        <span className="tag">WIC-301</span>
        <h2 id="wic-title">Pigment batch on a load cell</h2>
        <p>An ISA-88 style batch. Each pigment valve opens in turn until its target weight is reached; the tank colour is the weighted mix of what has been dosed.</p>
      </div>
      <div className="fp-body fp-split">
        <div className="tank-wrap">
          <svg viewBox="0 0 240 260" role="img" aria-label={`Tank holding ${gross.toFixed(1)} kg`}>
            {COMP.map((c, i) => (
              <g key={c.n}>
                <line x1={70 + i * 50} y1={4} x2={70 + i * 50} y2={30} stroke="var(--ink-2)" strokeWidth={3} />
                <path d={`M${62 + i * 50} 14 l16 10 v-10 l-16 10 z`} fill={i === active ? `rgb(${c.c})` : "var(--surface)"} stroke="var(--ink-2)" strokeWidth={1.5} />
                <text x={70 + i * 50} y={46} textAnchor="middle" fontSize="11" fill="var(--ink-2)" fontFamily="var(--font-head)">{c.tag}</text>
              </g>
            ))}
            <rect x={40} y={56} width={160} height={H + 4} rx={6} fill="var(--surface-2)" stroke="var(--ink-2)" strokeWidth={2.5} />
            {gross > 0 && <rect x={42} y={58 + H - fillH + 2} width={156} height={fillH} rx={4} fill={`rgb(${mix})`} style={{ transition: "y .1s linear, height .1s linear" }} />}
            {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={190} x2={200} y1={58 + H * (1 - f)} y2={58 + H * (1 - f)} stroke="var(--ink-3)" />)}
            <path d="M80 242 h80 l-12 14 h-56 z" fill="var(--line)" />
          </svg>
          <div className="readouts" style={{ width: "100%", maxWidth: 300 }}>
            <div className="readout"><span>Net weight</span><b>{(gross - tare).toFixed(2)}<small>kg</small></b></div>
          </div>
        </div>

        <div className="controls">
          <div>
            <h3 className="fp-section-title">Batch state</h3>
            <div className="states" role="status" aria-label={`Batch state: ${state}`}>
              {STATES.map((s) => <span key={s} className={"state" + (s === state ? " current" : "") + (s === "Aborted" ? " aborted" : s === "Complete" ? " complete" : "")}>{s}</span>)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label className="visually-hidden" htmlFor="recipe">Recipe</label>
            <select id="recipe" className="locale" disabled={state !== "Idle"} value={rec} onChange={(e) => setRec(e.target.value)}>
              {Object.keys(RECIPES).map((r) => <option key={r}>{r}</option>)}
            </select>
            <button className="btn" disabled={state !== "Idle" && state !== "Paused"} onClick={() => setState("Running")}>{state === "Paused" ? "Resume" : "Start"}</button>
            <button className="btn quiet" disabled={state !== "Running"} onClick={() => setState("Paused")}>Pause</button>
            <button className="btn quiet" disabled={state !== "Running" && state !== "Paused"} onClick={() => setState("Aborted")}>Abort</button>
          </div>
          <table className="dose">
            <thead><tr><th scope="col">Pigment</th><th scope="col">Target</th><th scope="col">Dosed</th><th scope="col">Deviation</th></tr></thead>
            <tbody>
              {COMP.map((c, i) => (
                <tr key={c.n} className={i === active ? "dosing" : undefined}>
                  <td><span className="swatch" style={{ background: `rgb(${c.c})` }} />{c.n}{i === active && " (dosing)"}</td>
                  <td className="num">{target[i].toFixed(1)}</td>
                  <td className="num">{dosed[i].toFixed(1)}</td>
                  <td className={"num" + (outOfTol(i) ? " bad" : "")}>{(dosed[i] - target[i]).toFixed(1)}{outOfTol(i) && " out of tolerance"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button className="linkbtn" onClick={() => setTare(gross)}>Tare the load cell</button>
            <button className="linkbtn" onClick={() => { reset(); setTare(0); }}>Reset batch</button>
          </div>
        </div>
      </div>
    </section>
  );
}
