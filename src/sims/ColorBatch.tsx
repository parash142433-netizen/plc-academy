import { useEffect, useRef, useState } from "react";

type State = "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "ABORTED";
const COMP = [{ n: "Red", c: [220, 38, 38] }, { n: "Green", c: [34, 197, 94] }, { n: "Blue", c: [59, 130, 246] }];
const RECIPES: Record<string, number[]> = { "Recipe A": [30, 50, 20], "Recipe B": [10, 20, 70] };
const RATE = 4; // kg/s per open valve
const TOL = 0.5; // kg

export function ColorBatch() {
  const [state, setState] = useState<State>("IDLE");
  const [rec, setRec] = useState("Recipe A");
  const [dosed, setDosed] = useState([0, 0, 0]);
  const [tare, setTare] = useState(0);
  const st = useRef({ state, dosed, rec });
  st.current = { state, dosed, rec };
  const target = RECIPES[rec];
  const active = state === "RUNNING" ? dosed.findIndex((d, i) => d < target[i]) : -1;

  useEffect(() => {
    const id = setInterval(() => {
      const { state, dosed, rec } = st.current;
      if (state !== "RUNNING") return;
      const i = dosed.findIndex((d, k) => d < RECIPES[rec][k]);
      if (i < 0) return setState("COMPLETED");
      setDosed((d) => d.map((v, k) => (k === i ? Math.min(RECIPES[rec][k], +(v + RATE * 0.1).toFixed(2)) : v)));
    }, 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (state === "RUNNING" && dosed.every((d, i) => d >= target[i])) setState("COMPLETED"); }, [dosed, state]);

  const gross = dosed.reduce((a, b) => a + b, 0);
  const total = gross || 1;
  const mix = COMP.reduce((a, c, i) => a.map((v, k) => v + (c.c[k] * dosed[i]) / total), [0, 0, 0]).map(Math.round);
  const level = Math.min(1, gross / 100);
  const reset = () => { setDosed([0, 0, 0]); setState("IDLE"); };
  const alarm = (i: number) => state === "COMPLETED" && Math.abs(dosed[i] - target[i]) > TOL;
  return (
    <div className="sim"><h2>Color batching — ISA-88 state model</h2>
      <div className="row">
        <select disabled={state !== "IDLE"} value={rec} onChange={(e) => setRec(e.target.value)}>{Object.keys(RECIPES).map((r) => <option key={r}>{r}</option>)}</select>
        <b>State: {state}</b>
        <button className="btn" disabled={state !== "IDLE" && state !== "PAUSED"} onClick={() => setState("RUNNING")}>{state === "PAUSED" ? "Resume" : "Start"}</button>
        <button className="btn ghost" disabled={state !== "RUNNING"} onClick={() => setState("PAUSED")}>Pause</button>
        <button className="btn ghost" disabled={state !== "RUNNING" && state !== "PAUSED"} onClick={() => setState("ABORTED")}>Abort</button>
        <button className="btn ghost" onClick={reset}>Reset</button>
        <button className="btn ghost" onClick={() => setTare(gross)}>Tare</button>
      </div>
      <svg viewBox="0 0 200 140" width="260"><rect x="40" y="10" width="120" height="120" fill="none" stroke="#64748b" strokeWidth="3" />
        <rect x="42" y={128 - 116 * level} width="116" height={116 * level} fill={`rgb(${mix})`} />
        {COMP.map((c, i) => <circle key={i} cx={60 + i * 40} cy="6" r="5" fill={i === active ? `rgb(${c.c})` : "#cbd5e1"} />)}</svg>
      <p style={{ font: "20px monospace" }}>Load cell: {(gross - tare).toFixed(2)} kg (tare {tare.toFixed(1)})</p>
      {COMP.map((c, i) => <div key={c.n}>{c.n}: {dosed[i].toFixed(1)} / {target[i]} kg {alarm(i) && <b style={{ color: "#dc2626" }}>⚠ out of tolerance</b>}</div>)}
    </div>
  );
}
