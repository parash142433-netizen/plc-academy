import { useEffect, useRef, useState } from "react";

const DT = 0.5, C = 500, K_LOSS = 1.2, T_AMB = 20, Q_MAX = 4000, DELAY_STEPS = 6, HIST = 400;

export function ThermalPID() {
  const [kp, setKp] = useState(8), [ti, setTi] = useState(60), [td, setTd] = useState(5);
  const [sp, setSp] = useState(60), [auto, setAuto] = useState(true), [manual, setManual] = useState(30);
  const p = useRef({ kp, ti, td, sp, auto, manual });
  p.current = { kp, ti, td, sp, auto, manual };
  const s = useRef({ T: T_AMB, I: 0, prevE: 0, mv: 0, wasAuto: true, pvBuf: Array(DELAY_STEPS).fill(T_AMB), hist: [] as number[][] });
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const { kp, ti, td, sp, auto, manual } = p.current, x = s.current;
      const pv = x.pvBuf[0];
      const e = sp - pv;
      if (auto) {
        if (!x.wasAuto) x.I = x.mv - kp * e; // bumpless Manual->Auto: preload integral so MV stays put
        const d = (e - x.prevE) / DT;
        const unsat = kp * e + x.I + kp * td * d;
        const mv = Math.min(100, Math.max(0, unsat));
        if (mv === unsat || (unsat > 100 && e < 0) || (unsat < 0 && e > 0)) x.I += (kp / ti) * e * DT; // anti-windup
        x.mv = mv;
      } else x.mv = manual;
      x.wasAuto = auto; x.prevE = e;
      const qIn = (x.mv / 100) * Q_MAX, qLoss = K_LOSS * (x.T - T_AMB) * 10;
      x.T += ((qIn - qLoss) / C) * DT * 0.2; // dT/dt = (Q_in - Q_loss)/C
      x.pvBuf.push(x.T); x.pvBuf.shift();
      x.hist.push([sp, pv, x.mv]); if (x.hist.length > HIST) x.hist.shift();
      draw();
    }, DT * 200);
    return () => clearInterval(id);
  }, []);

  function draw() {
    const c = cv.current; if (!c) return; const g = c.getContext("2d")!;
    const W = c.width, H = c.height; g.clearRect(0, 0, W, H);
    g.strokeStyle = "#334155"; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, (H * i) / 4); g.lineTo(W, (H * i) / 4); g.stroke(); }
    const line = (i: number, col: number | string, max: number) => {
      g.strokeStyle = col as string; g.beginPath();
      s.current.hist.forEach((h, k) => { const px = (k / HIST) * W, py = H - (h[i] / max) * H; k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    };
    line(0, "#facc15", 100); line(1, "#38bdf8", 100); line(2, "#f87171", 100);
  }
  const num = (l: string, v: number, set: (n: number) => void, min: number, max: number, step = 1) =>
    <label>{l}: {v}<input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} /></label>;
  return (
    <div className="sim"><h2>Thermal process — PID loop</h2>
      <canvas ref={cv} width={800} height={240} />
      <small><span style={{ color: "#facc15" }}>SP</span> · <span style={{ color: "#38bdf8" }}>PV (°C)</span> · <span style={{ color: "#f87171" }}>MV (%)</span> — 0–100 scale</small>
      <div className="row">
        {num("Kp", kp, setKp, 0, 30, 0.5)}{num("Ti (s)", ti, setTi, 5, 300)}{num("Td (s)", td, setTd, 0, 30)}{num("SP °C", sp, setSp, 20, 95)}
        <button className="btn" onClick={() => setAuto(!auto)}>{auto ? "AUTO" : "MANUAL"}</button>
        {!auto && num("Manual MV %", manual, setManual, 0, 100)}
        <button className="btn ghost" onClick={() => { s.current.T -= 10; s.current.pvBuf = s.current.pvBuf.map((v) => v - 10); }}>Cold fluid disturbance</button>
      </div>
    </div>
  );
}
