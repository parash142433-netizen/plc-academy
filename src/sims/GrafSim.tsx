import { useEffect, useRef, useState } from "react";

const STEPS = [
  { name: "Idle", action: "Wait for start" },
  { name: "Tank filling", action: "Inlet valve XV-1 open" },
  { name: "Heating", action: "Heater E-1 on" },
  { name: "Agitation", action: "Agitator M-1 on for 5 s" },
  { name: "Discharge", action: "Outlet valve XV-2 open" },
];
const AGIT_SECONDS = 5;

type Inputs = { start: boolean; high: boolean; temp: boolean; low: boolean };
const IO: { k: keyof Inputs; tag: string; label: string }[] = [
  { k: "start", tag: "HS-1", label: "Start push button" },
  { k: "high", tag: "LSH-1", label: "Tank level high" },
  { k: "temp", tag: "TSH-1", label: "Temperature at setpoint" },
  { k: "low", tag: "LSL-1", label: "Tank level low" },
];
const INITIAL: Inputs = { start: false, high: false, temp: false, low: true };

export function GrafSim() {
  const [step, setStep] = useState(0);
  const [inp, setInp] = useState<Inputs>(INITIAL);
  const [timer, setTimer] = useState(0);
  const [log, setLog] = useState<{ t: string; on: boolean; text: string }[]>([]);
  const t0 = useRef(Date.now());
  const consoleRef = useRef<HTMLDivElement>(null);
  const stamp = () => ((Date.now() - t0.current) / 1000).toFixed(1).padStart(6) + " s";

  useEffect(() => {
    const id = setInterval(() => step === 3 && setTimer((t) => +(t + 0.1).toFixed(1)), 100);
    return () => clearInterval(id);
  }, [step]);

  // Receptivity of the transition below each step (IEC 60848). t5 returns to the initial step.
  const receptivity = [inp.start, inp.high, inp.temp, timer >= AGIT_SECONDS, inp.low];
  const cond = receptivity[step];
  useEffect(() => {
    if (!cond) return;
    const to = (step + 1) % STEPS.length;
    const t = stamp();
    setLog((l) => [...l, { t, on: false, text: `X${step + 1} ${STEPS[step].name} deactivated` }, { t, on: true, text: `X${to + 1} ${STEPS[to].name} activated` }]);
    setStep(to); setTimer(0);
  }, [cond, step]);
  useEffect(() => { consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight }); }, [log]);

  const reset = () => { setStep(0); setTimer(0); setLog([]); setInp(INITIAL); t0.current = Date.now(); };
  const condText = [
    <><b>t1</b>HS-1 start pressed</>,
    <><b>t2</b>LSH-1 level high</>,
    <><b>t3</b>TSH-1 temperature reached</>,
    <><b>t4</b>X4 for {AGIT_SECONDS} s <span className={timer >= AGIT_SECONDS ? "true" : undefined}>({timer.toFixed(1)} s)</span></>,
  ];

  return (
    <section className="faceplate" aria-labelledby="sfc-title">
      <div className="fp-head">
        <span className="tag">SFC-101</span>
        <h2 id="sfc-title">Tank batch sequence</h2>
        <p>A five-step GRAFCET. Operate the field inputs on the right and watch the active step (the filled box) move down the chart. The initial step has a double frame.</p>
      </div>
      <div className="fp-body fp-split">
        <div>
          <ol className="grafcet" aria-label="Sequence chart">
            {STEPS.map((s, i) => (
              <li key={s.name}>
                <div className="gc-step">
                  <div className={"gc-box" + (i === 0 ? " initial" : "") + (i === step ? " active" : "")} aria-label={`Step ${i + 1}${i === step ? ", active" : ""}`}>{i + 1}</div>
                  <div className={"gc-action" + (i === step ? " active" : "")}><b>{s.name}</b><span>{s.action}</span></div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="gc-trans">
                    <div className={"gc-link" + (i === step ? " armed" : "")} aria-hidden="true" />
                    <div className="gc-cond">{condText[i]}</div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="gc-return"><b style={{ fontFamily: "var(--font-head)", color: "var(--ink)" }}>t5</b> LSL-1 level low, back to step 1{step === 4 && " (armed)"}</p>
        </div>

        <div>
          <h3 className="fp-section-title">Field inputs</h3>
          <div className="io-grid">
            {IO.map(({ k, tag, label }) => (
              <button key={k} type="button" className="io" aria-pressed={inp[k]} onClick={() => setInp((v) => ({ ...v, [k]: !v[k] }))}>
                <b>{tag}</b><span>{label}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><button className="btn quiet" onClick={reset}>Reset sequence</button></div>
          <h3 className="fp-section-title" style={{ marginTop: 18 }}>Step log</h3>
          <div className="console" ref={consoleRef} role="log" aria-live="polite">
            {log.map((l, i) => <div key={i} className={l.on ? "on" : "off"}>{l.t}  {l.on ? "+" : "-"} {l.text}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
