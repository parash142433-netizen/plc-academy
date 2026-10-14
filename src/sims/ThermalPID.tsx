import { useEffect, useRef, useState } from "react";

const DT = 0.5, C = 500, K_LOSS = 1.2, T_AMB = 20, Q_MAX = 4000, DELAY_STEPS = 6, HIST = 400;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function ThermalPID() {
  const [kp, setKp] = useState(8), [ti, setTi] = useState(60), [td, setTd] = useState(5);
  const [sp, setSp] = useState(60), [auto, setAuto] = useState(true), [manual, setManual] = useState(30);
  const [pvOut, setPvOut] = useState(T_AMB), [mvOut, setMvOut] = useState(0);
  const p = useRef({ kp, ti, td, sp, auto, manual });
  p.current = { kp, ti, td, sp, auto, manual };
  const s = useRef({ T: T_AMB, I: 0, prevE: 0, mv: 0, wasAuto: true, pvBuf: Array(DELAY_STEPS).fill(T_AMB), hist: [] as number[][] });
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let tick = 0;
    const id = setInterval(() => {
      const { kp, ti, td, sp, auto, manual } = p.current, x = s.current;
      const pv = x.pvBuf[0];
      const e = sp - pv;
      if (auto) {
        if (!x.wasAuto) x.I = x.mv - kp * e; // bumpless Manual -> Auto: preload the integral so MV holds
        const d = (e - x.prevE) / DT;
        const unsat = kp * e + x.I + kp * td * d;
        const mv = Math.min(100, Math.max(0, unsat));
        if (mv === unsat || (unsat > 100 && e < 0) || (unsat < 0 && e > 0)) x.I += (kp / ti) * e * DT; // anti-windup
        x.mv = mv;
      } else x.mv = manual;
      x.wasAuto = auto; x.prevE = e;
      const qIn = (x.mv / 100) * Q_MAX, qLoss = K_LOSS * (x.T - T_AMB) * 10;
      x.T += ((qIn - qLoss) / C) * DT * 0.2; // dT/dt = (Q_in - Q_loss) / C
      x.pvBuf.push(x.T); x.pvBuf.shift();
      x.hist.push([sp, pv, x.mv]); if (x.hist.length > HIST) x.hist.shift();
      draw();
      if (++tick % 2 === 0) { setPvOut(pv); setMvOut(x.mv); }
    }, DT * 200);
    return () => clearInterval(id);
  }, []);

  function draw() {
    const c = cv.current; if (!c) return; const g = c.getContext("2d")!;
    const W = c.width, H = c.height; g.clearRect(0, 0, W, H);
    g.fillStyle = css("--trend-bg"); g.fillRect(0, 0, W, H);
    g.strokeStyle = css("--trend-grid"); g.lineWidth = 1;
    g.font = `12px ${css("--font-mono") || "monospace"}`; g.fillStyle = css("--ink-3");
    for (let i = 0; i <= 4; i++) {
      const y = Math.round((H * i) / 4) + 0.5;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      if (i < 4) g.fillText(String(100 - i * 25), 6, y + 14);
    }
    const line = (i: number, col: string, width: number, dash: number[] = []) => {
      g.strokeStyle = col; g.lineWidth = width; g.setLineDash(dash); g.beginPath();
      s.current.hist.forEach((h, k) => { const px = (k / HIST) * W, py = H - (h[i] / 100) * H; k ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.stroke(); g.setLineDash([]);
    };
    line(2, css("--ink-3"), 1.5);           // MV: grey
    line(0, css("--ink"), 1.5, [6, 5]);     // SP: dashed
    line(1, css("--accent"), 2.5);          // PV: instrument blue
  }

  const slider = (id: string, l: string, v: number, set: (n: number) => void, min: number, max: number, step = 1, unit = "") => (
    <div className="slider">
      <label htmlFor={id}>{l}</label><output htmlFor={id}>{v}{unit}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} />
    </div>
  );
  const err = sp - pvOut;
  const hiAlarm = pvOut > 95;

  return (
    <section className="faceplate" aria-labelledby="tic-title">
      <div className="fp-head">
        <span className="tag">TIC-201</span>
        <h2 id="tic-title">Heated tank temperature loop</h2>
        <p>A tank with a heater, heat loss to a 20 °C room and a measurement lag of three seconds. The controller is a PID with anti-windup and bumpless transfer from manual to auto.</p>
      </div>
      <div className="fp-body fp-split">
        <div>
          <canvas ref={cv} className="trend" width={800} height={300} aria-label="Trend of setpoint, process value and controller output" />
          <div className="legend">
            <span><i style={{ borderTopStyle: "dashed", borderColor: "var(--ink)" }} />SP setpoint</span>
            <span><i style={{ borderColor: "var(--accent)", borderTopWidth: 3 }} />PV temperature, °C</span>
            <span><i style={{ borderColor: "var(--ink-3)" }} />MV heater output, %</span>
          </div>
          <div className="readouts" style={{ marginTop: 16 }}>
            <div className="readout"><span>SP</span><b>{sp.toFixed(1)}<small>°C</small></b></div>
            <div className={"readout" + (hiAlarm ? " alarm" : "")}><span>PV{hiAlarm && ", high alarm"}</span><b>{pvOut.toFixed(1)}<small>°C</small></b></div>
            <div className="readout"><span>Error</span><b>{err > 0 ? "+" : ""}{err.toFixed(1)}<small>°C</small></b></div>
            <div className="readout"><span>MV</span><b>{mvOut.toFixed(0)}<small>%</small></b></div>
          </div>
        </div>

        <div className="controls">
          <div>
            <h3 className="fp-section-title">Mode</h3>
            <div className="segmented" role="group" aria-label="Controller mode">
              <button aria-pressed={auto} onClick={() => setAuto(true)}>Auto</button>
              <button aria-pressed={!auto} onClick={() => { setManual(Math.round(s.current.mv)); setAuto(false); }}>Manual</button>
            </div>
          </div>
          {auto ? slider("sp", "Setpoint", sp, setSp, 20, 95, 1, " °C") : slider("mv", "Heater output", manual, setManual, 0, 100, 1, " %")}
          <div>
            <h3 className="fp-section-title">Tuning</h3>
            <div className="controls">
              {slider("kp", "Gain Kp", kp, setKp, 0, 30, 0.5)}
              {slider("ti", "Integral time Ti", ti, setTi, 5, 300, 1, " s")}
              {slider("td", "Derivative time Td", td, setTd, 0, 30, 1, " s")}
            </div>
          </div>
          <div>
            <button className="btn quiet" onClick={() => { s.current.T -= 10; s.current.pvBuf = s.current.pvBuf.map((v) => v - 10); }}>Add cold fluid (−10 °C)</button>
          </div>
        </div>
      </div>
    </section>
  );
}
