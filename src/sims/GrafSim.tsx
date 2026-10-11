import { useEffect, useRef, useState } from "react";

const NAMES = ["Idle", "Tank filling", "Heating", "Agitation", "Discharge"];
const AGIT_SECONDS = 5;

export function GrafSim() {
  const [step, setStep] = useState(0);
  const [inp, setInp] = useState({ start: false, high: false, temp: false, low: true });
  const [timer, setTimer] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const t0 = useRef(Date.now());
  const stamp = () => ((Date.now() - t0.current) / 1000).toFixed(1).padStart(6) + "s";

  const goto = (from: number, to: number) => {
    setLog((l) => [...l, `${stamp()}  - S${from + 1} ${NAMES[from]} deactivated`, `${stamp()}  + S${to + 1} ${NAMES[to]} activated`]);
    setStep(to); setTimer(0);
  };
  useEffect(() => {
    const id = setInterval(() => step === 3 && setTimer((t) => +(t + 0.1).toFixed(1)), 100);
    return () => clearInterval(id);
  }, [step]);
  // transition conditions (IEC 60848): fired when active step's receptivity is true
  const cond = [inp.start, inp.high, inp.temp, timer >= AGIT_SECONDS, inp.low][step];
  useEffect(() => { if (cond) goto(step, (step + 1) % 5); }, [cond, step]);

  const tog = (k: keyof typeof inp) => setInp((i) => ({ ...i, [k]: !i[k] }));
  return (
    <div className="sim"><h2>GrafSim — GRAFCET / SFC</h2>
      <div>{NAMES.map((n, i) => <span key={n}><span className={"step" + (i === step ? " on" : "")}>S{i + 1} {n}</span>{i < 4 && <small> ─ t{i + 1} ─ </small>}</span>)}</div>
      <p>Transitions: t1 Start · t2 Level High · t3 Temp reached · t4 timer {AGIT_SECONDS}s ({timer.toFixed(1)}s) · t5 Level Low (→ S1)</p>
      <div className="row">
        {(["start", "high", "temp", "low"] as const).map((k) => <label key={k}><input type="checkbox" checked={inp[k]} onChange={() => tog(k)} /> {{ start: "Start PB", high: "Level HIGH", temp: "Temp SP reached", low: "Level LOW" }[k]}</label>)}
        <button className="btn ghost" onClick={() => { setStep(0); setTimer(0); setLog([]); setInp({ start: false, high: false, temp: false, low: true }); t0.current = Date.now(); }}>Reset</button>
      </div>
      <div className="log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>
    </div>
  );
}
