import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#090E1A",
  surface: "#0D1526",
  card: "#111D35",
  cardHover: "#162240",
  border: "#1E2E4A",
  accent: "#00D4FF",
  accentGlow: "rgba(0,212,255,0.15)",
  green: "#00E676",
  greenDim: "rgba(0,230,118,0.12)",
  red: "#FF3D57",
  redDim: "rgba(255,61,87,0.12)",
  gold: "#FFB800",
  purple: "#7C4DFF",
  text: "#E8F0FF",
  muted: "#5A7099",
  dim: "#2A3A5C",
};

// Seeded random for stable data
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateOptionChain(spot, seed = 42) {
  const rand = seededRand(seed);
  const strikes = [];
  const base = Math.round(spot / 50) * 50;
  for (let i = -8; i <= 8; i++) {
    const strike = base + i * 50;
    const moneyness = (spot - strike) / spot;
    const callPrem = Math.max(2, spot * Math.max(0, moneyness) + (rand() * 30 + 5));
    const putPrem = Math.max(2, spot * Math.max(0, -moneyness) + (rand() * 30 + 5));
    strikes.push({
      strike,
      callPrem: +callPrem.toFixed(2),
      callOI: Math.floor(rand() * 5000 + 500) * 100,
      callVol: Math.floor(rand() * 2000 + 100),
      callIV: +(rand() * 20 + 12).toFixed(1),
      callChg: +((rand() - 0.4) * 20).toFixed(2),
      putPrem: +putPrem.toFixed(2),
      putOI: Math.floor(rand() * 5000 + 500) * 100,
      putVol: Math.floor(rand() * 2000 + 100),
      putIV: +(rand() * 20 + 12).toFixed(1),
      putChg: +((rand() - 0.4) * 20).toFixed(2),
      pcr: +(rand() * 1.5 + 0.5).toFixed(2),
      atm: Math.abs(i) <= 1,
    });
  }
  return strikes;
}

const STOCKS = [
  { sym: "NIFTY", name: "Nifty 50", price: 24382.65, chg: 127.4, pct: 0.52, sec: "Index" },
  { sym: "BANKNIFTY", name: "Bank Nifty", price: 52140.30, chg: -215.6, pct: -0.41, sec: "Index" },
  { sym: "RELIANCE", name: "Reliance Ind.", price: 2987.45, chg: 34.2, pct: 1.16, sec: "Energy" },
  { sym: "TCS", name: "Tata Consultancy", price: 4123.80, chg: -18.5, pct: -0.45, sec: "IT" },
  { sym: "INFY", name: "Infosys", price: 1876.25, chg: 22.1, pct: 1.19, sec: "IT" },
  { sym: "HDFC", name: "HDFC Bank", price: 1742.60, chg: -8.3, pct: -0.47, sec: "Banking" },
  { sym: "ICICIBANK", name: "ICICI Bank", price: 1398.90, chg: 19.4, pct: 1.41, sec: "Banking" },
  { sym: "SBIN", name: "State Bank", price: 872.35, chg: 7.8, pct: 0.90, sec: "Banking" },
  { sym: "TATAMOTORS", name: "Tata Motors", price: 1021.50, chg: 31.7, pct: 3.20, sec: "Auto" },
  { sym: "BAJFINANCE", name: "Bajaj Finance", price: 7845.20, chg: -62.4, pct: -0.79, sec: "NBFC" },
];

const AI_SIGNALS = [
  { sym: "TATAMOTORS", signal: "BUY", entry: 1020, target: 1085, sl: 990, rr: "2.1x", conf: 87, type: "Breakout" },
  { sym: "ICICIBANK", signal: "BUY", entry: 1398, target: 1450, sl: 1372, rr: "1.9x", conf: 82, type: "Momentum" },
  { sym: "INFY", signal: "SELL", entry: 1876, target: 1820, sl: 1902, rr: "2.2x", conf: 79, type: "Reversal" },
  { sym: "BANKNIFTY", signal: "HOLD", entry: 52140, target: 52800, sl: 51600, rr: "1.2x", conf: 68, type: "Trend" },
  { sym: "RELIANCE", signal: "BUY", entry: 2987, target: 3100, sl: 2930, rr: "2.0x", conf: 91, type: "Breakout" },
];

const SCREENER_RESULTS = [
  { sym: "TATAMOTORS CE 1020", premium: 31.7, chg: 43.2, vol: 12450, oi: 234000, iv: 28.4, signal: "Premium Breakout" },
  { sym: "RELIANCE CE 3000", premium: 18.9, chg: 61.8, vol: 8900, oi: 189000, iv: 22.1, signal: "Volume Spike" },
  { sym: "NIFTY CE 24400", premium: 87.5, chg: 28.4, vol: 52000, oi: 1240000, iv: 16.8, signal: "OI Build-Up" },
  { sym: "ICICIBANK CE 1400", premium: 22.3, chg: 34.7, vol: 6700, oi: 145000, iv: 25.3, signal: "IV Expansion" },
  { sym: "SBIN PE 860", premium: 9.8, chg: -18.4, vol: 4200, oi: 98000, iv: 31.2, signal: "PCR Drop" },
];

// Mini sparkline SVG
function Sparkline({ data, color, width = 80, height = 28 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Mini candle chart
function MiniCandles({ seed = 1 }) {
  const rand = seededRand(seed);
  const candles = Array.from({ length: 20 }, (_, i) => {
    const o = 100 + rand() * 20;
    const c = o + (rand() - 0.45) * 10;
    const h = Math.max(o, c) + rand() * 5;
    const l = Math.min(o, c) - rand() * 5;
    return { o, c, h, l };
  });
  const allPrices = candles.flatMap(c => [c.h, c.l]);
  const min = Math.min(...allPrices), max = Math.max(...allPrices);
  const range = max - min;
  const W = 160, H = 48;
  const cw = W / candles.length;
  return (
    <svg width={W} height={H}>
      {candles.map((c, i) => {
        const x = i * cw + cw * 0.2;
        const bodyW = cw * 0.6;
        const yHigh = H - ((c.h - min) / range) * H;
        const yLow = H - ((c.l - min) / range) * H;
        const yOpen = H - ((c.o - min) / range) * H;
        const yClose = H - ((c.c - min) / range) * H;
        const bull = c.c >= c.o;
        const col = bull ? COLORS.green : COLORS.red;
        return (
          <g key={i}>
            <line x1={x + bodyW / 2} y1={yHigh} x2={x + bodyW / 2} y2={yLow} stroke={col} strokeWidth="0.8" />
            <rect x={x} y={Math.min(yOpen, yClose)} width={bodyW} height={Math.max(1, Math.abs(yClose - yOpen))} fill={bull ? COLORS.greenDim : COLORS.redDim} stroke={col} strokeWidth="0.8" rx="0.5" />
          </g>
        );
      })}
    </svg>
  );
}

// Circular gauge
function Gauge({ value, max = 100, color, size = 52, label }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / max) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.dim} strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">{value}</text>
      </svg>
      <span style={{ fontSize: 10, color: COLORS.muted }}>{label}</span>
    </div>
  );
}

// Heatmap tile
function HeatTile({ name, pct }) {
  const bg = pct > 0
    ? `rgba(0,230,118,${Math.min(0.8, Math.abs(pct) / 5)})`
    : `rgba(255,61,87,${Math.min(0.8, Math.abs(pct) / 5)})`;
  return (
    <div style={{
      background: bg, border: `1px solid ${pct > 0 ? COLORS.green : COLORS.red}22`,
      borderRadius: 6, padding: "8px 6px", textAlign: "center", cursor: "pointer",
      transition: "transform 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <div style={{ fontSize: 10, color: COLORS.text, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 11, color: pct > 0 ? COLORS.green : COLORS.red, fontWeight: 700 }}>{pct > 0 ? "+" : ""}{pct}%</div>
    </div>
  );
}

const TABS = ["Dashboard", "Option Chain", "Screener", "AI Signals", "Charts"];

export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [selectedStock, setSelectedStock] = useState(STOCKS[0]);
  const [chain, setChain] = useState(() => generateOptionChain(STOCKS[0].price));
  const [ticker, setTicker] = useState(0);
  const [prices, setPrices] = useState(() => STOCKS.map(s => s.price));
  const [screenerFilter, setScreenerFilter] = useState("All");
  const [watchlist, setWatchlist] = useState(["NIFTY", "RELIANCE", "TCS"]);
  const [alertActive, setAlertActive] = useState(false);

  // Simulate live price ticks
  useEffect(() => {
    const id = setInterval(() => {
      setPrices(prev => prev.map((p, i) => +(p + (Math.random() - 0.495) * p * 0.001).toFixed(2)));
      setTicker(t => t + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setChain(generateOptionChain(prices[STOCKS.findIndex(s => s.sym === selectedStock.sym)] || selectedStock.price, ticker));
  }, [selectedStock, ticker]);

  const spark = (seed) => {
    const r = seededRand(seed + ticker);
    return Array.from({ length: 20 }, () => r() * 100);
  };

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh", fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      color: COLORS.text, fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(90deg, ${COLORS.surface} 0%, #0A1220 100%)`,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "0 20px", display: "flex", alignItems: "center", gap: 16,
        height: 52, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900,
          }}>⚡</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.5 }}>
            <span style={{ color: COLORS.accent }}>Quan</span>tEdge
          </span>
          <span style={{
            background: COLORS.accentGlow, border: `1px solid ${COLORS.accent}44`,
            color: COLORS.accent, fontSize: 9, fontWeight: 700, padding: "1px 6px",
            borderRadius: 4, letterSpacing: 0.5,
          }}>LIVE</span>
        </div>
        {/* Ticker strip */}
        <div style={{
          flex: 1, overflow: "hidden", display: "flex", gap: 20,
          maskImage: "linear-gradient(90deg, transparent, black 5%, black 95%, transparent)",
        }}>
          {STOCKS.slice(0, 6).map((s, i) => (
            <div key={s.sym} style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
              <span style={{ color: COLORS.muted, fontSize: 11 }}>{s.sym}</span>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{prices[i]?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              <span style={{ color: prices[i] > s.price ? COLORS.green : COLORS.red, fontSize: 11 }}>
                {prices[i] > s.price ? "▲" : "▼"} {Math.abs(((prices[i] - s.price) / s.price * 100)).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: COLORS.green,
            boxShadow: `0 0 8px ${COLORS.green}`,
            animation: "pulse 1.5s infinite",
          }} />
          <span style={{ color: COLORS.green, fontSize: 11, fontWeight: 600 }}>Market Open</span>
          <div style={{
            background: alertActive ? COLORS.accent : COLORS.dim,
            border: `1px solid ${alertActive ? COLORS.accent : COLORS.border}`,
            borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
            transition: "all 0.2s",
          }} onClick={() => setAlertActive(!alertActive)}>
            🔔 Alerts
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{
        background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", padding: "0 20px", gap: 4,
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", color: tab === t ? COLORS.accent : COLORS.muted,
            fontWeight: tab === t ? 700 : 500, fontSize: 13, padding: "12px 16px",
            cursor: "pointer", borderBottom: `2px solid ${tab === t ? COLORS.accent : "transparent"}`,
            transition: "all 0.15s",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>

        {/* ── DASHBOARD TAB ── */}
        {tab === "Dashboard" && (
          <div style={{ display: "grid", gap: 14 }}>

            {/* Market Overview Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "NIFTY 50", val: prices[0]?.toLocaleString("en-IN", { maximumFractionDigits: 2 }), chg: "+0.52%", up: true },
                { label: "BANK NIFTY", val: prices[1]?.toLocaleString("en-IN", { maximumFractionDigits: 2 }), chg: "-0.41%", up: false },
                { label: "VIX", val: "14.23", chg: "-1.2%", up: false },
                { label: "PCR (Overall)", val: "1.24", chg: "+0.08", up: true },
              ].map((m, i) => (
                <div key={i} style={{
                  background: COLORS.card, border: `1px solid ${COLORS.border}`,
                  borderRadius: 10, padding: "12px 14px",
                  borderTop: `2px solid ${m.up ? COLORS.green : COLORS.red}`,
                }}>
                  <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>{m.val}</div>
                  <div style={{ color: m.up ? COLORS.green : COLORS.red, fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                    {m.up ? "▲" : "▼"} {m.chg}
                  </div>
                </div>
              ))}
            </div>

            {/* Main Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
              {/* Left */}
              <div style={{ display: "grid", gap: 14 }}>

                {/* Stock Table */}
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>📊 F&O Stocks — Live</span>
                    <span style={{ color: COLORS.muted, fontSize: 11 }}>Auto-refreshing</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: COLORS.surface }}>
                        {["Symbol", "LTP", "Chg%", "Volume", "OI", "Trend"].map(h => (
                          <th key={h} style={{ padding: "8px 14px", color: COLORS.muted, fontWeight: 600, fontSize: 11, textAlign: "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STOCKS.map((s, i) => {
                        const pct = ((prices[i] - s.price) / s.price * 100);
                        const up = pct >= 0;
                        return (
                          <tr key={s.sym}
                            onClick={() => { setSelectedStock(s); setTab("Option Chain"); }}
                            style={{
                              borderTop: `1px solid ${COLORS.border}`, cursor: "pointer",
                              background: selectedStock.sym === s.sym ? COLORS.accentGlow : "transparent",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = COLORS.cardHover}
                            onMouseLeave={e => e.currentTarget.style.background = selectedStock.sym === s.sym ? COLORS.accentGlow : "transparent"}
                          >
                            <td style={{ padding: "9px 14px" }}>
                              <div style={{ fontWeight: 700 }}>{s.sym}</div>
                              <div style={{ fontSize: 10, color: COLORS.muted }}>{s.sec}</div>
                            </td>
                            <td style={{ padding: "9px 14px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                              ₹{prices[i]?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "9px 14px" }}>
                              <span style={{
                                color: up ? COLORS.green : COLORS.red, fontWeight: 700,
                                background: up ? COLORS.greenDim : COLORS.redDim,
                                padding: "2px 7px", borderRadius: 4, fontSize: 11,
                              }}>
                                {up ? "+" : ""}{pct.toFixed(2)}%
                              </span>
                            </td>
                            <td style={{ padding: "9px 14px", color: COLORS.muted }}>
                              {(Math.floor(Math.random() * 9000) + 1000).toLocaleString()}K
                            </td>
                            <td style={{ padding: "9px 14px", color: COLORS.muted }}>
                              {(Math.floor(Math.random() * 500) + 100).toLocaleString()}K
                            </td>
                            <td style={{ padding: "9px 14px" }}>
                              <Sparkline data={spark(i * 7 + 1)} color={up ? COLORS.green : COLORS.red} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sector Heatmap */}
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>🌡️ Sector Heatmap</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                    {[
                      ["IT", 1.24], ["Banking", -0.38], ["Auto", 2.1], ["Pharma", 0.67],
                      ["Energy", 1.89], ["FMCG", -0.22], ["Metal", 3.12], ["Realty", -1.04],
                      ["Infra", 0.55], ["Media", -0.91], ["Telecom", 0.34], ["Defence", 1.78],
                    ].map(([n, p]) => <HeatTile key={n} name={n} pct={p} />)}
                  </div>
                </div>
              </div>

              {/* Right Panel */}
              <div style={{ display: "grid", gap: 14, alignContent: "start" }}>

                {/* FII/DII */}
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>🏦 FII / DII Activity</div>
                  {[
                    { label: "FII Buy", val: "₹4,821 Cr", color: COLORS.green },
                    { label: "FII Sell", val: "₹3,104 Cr", color: COLORS.red },
                    { label: "DII Buy", val: "₹2,945 Cr", color: COLORS.green },
                    { label: "DII Sell", val: "₹1,872 Cr", color: COLORS.red },
                    { label: "Net FII", val: "+₹1,717 Cr", color: COLORS.accent },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                      <span style={{ color: COLORS.muted, fontSize: 12 }}>{r.label}</span>
                      <span style={{ color: r.color, fontWeight: 700, fontSize: 12 }}>{r.val}</span>
                    </div>
                  ))}
                </div>

                {/* Market Sentiment */}
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>📡 Market Sentiment</div>
                  <div style={{ display: "flex", justifyContent: "space-around" }}>
                    <Gauge value={72} color={COLORS.green} label="Bullish" />
                    <Gauge value={58} color={COLORS.accent} label="Momentum" />
                    <Gauge value={34} color={COLORS.red} label="Fear" />
                  </div>
                  <div style={{ marginTop: 12, background: COLORS.surface, borderRadius: 6, padding: "8px 10px", fontSize: 12, color: COLORS.muted }}>
                    📈 Market in <span style={{ color: COLORS.green, fontWeight: 700 }}>Bullish</span> mode. Advance-Decline: <span style={{ color: COLORS.green }}>1842</span> vs <span style={{ color: COLORS.red }}>612</span>
                  </div>
                </div>

                {/* Watchlist */}
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>⭐ Watchlist</div>
                  {STOCKS.filter(s => watchlist.includes(s.sym)).map((s, i) => (
                    <div key={s.sym} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{s.sym}</div>
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>₹{prices[STOCKS.indexOf(s)]?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                        <div style={{ color: s.chg > 0 ? COLORS.green : COLORS.red, fontSize: 11 }}>{s.chg > 0 ? "+" : ""}{s.pct}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OPTION CHAIN TAB ── */}
        {tab === "Option Chain" && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Stock selector */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {STOCKS.slice(0, 6).map((s, i) => (
                <button key={s.sym} onClick={() => setSelectedStock(s)} style={{
                  background: selectedStock.sym === s.sym ? COLORS.accentGlow : COLORS.card,
                  border: `1px solid ${selectedStock.sym === s.sym ? COLORS.accent : COLORS.border}`,
                  color: selectedStock.sym === s.sym ? COLORS.accent : COLORS.text,
                  borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 12,
                  transition: "all 0.15s",
                }}>{s.sym}</button>
              ))}
              <div style={{ marginLeft: "auto", color: COLORS.muted, fontSize: 12 }}>
                Spot: <span style={{ color: COLORS.accent, fontWeight: 700 }}>
                  ₹{prices[STOCKS.findIndex(s => s.sym === selectedStock.sym)]?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
                &nbsp;|&nbsp; Expiry: <span style={{ color: COLORS.gold, fontWeight: 600 }}>26 Jun 2026</span>
              </div>
            </div>

            {/* OI Bar visual */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
                {[
                  { label: "Total Call OI", val: "1,24,56,000", color: COLORS.red },
                  { label: "Total Put OI", val: "1,38,92,000", color: COLORS.green },
                  { label: "PCR", val: "1.11", color: COLORS.accent },
                  { label: "Max Pain", val: "24,300", color: COLORS.gold },
                  { label: "IVP", val: "42%", color: COLORS.purple },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ color: COLORS.muted, fontSize: 10 }}>{r.label}</div>
                    <div style={{ color: r.color, fontWeight: 700, fontSize: 14 }}>{r.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Option Chain Table */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: COLORS.surface }}>
                      <th colSpan={5} style={{ padding: "8px", color: COLORS.green, fontWeight: 700, textAlign: "center", borderRight: `2px solid ${COLORS.dim}` }}>CALLS</th>
                      <th style={{ padding: "8px", color: COLORS.accent, fontWeight: 800, textAlign: "center", fontSize: 13 }}>STRIKE</th>
                      <th colSpan={5} style={{ padding: "8px", color: COLORS.red, fontWeight: 700, textAlign: "center", borderLeft: `2px solid ${COLORS.dim}` }}>PUTS</th>
                    </tr>
                    <tr style={{ background: `${COLORS.surface}88` }}>
                      {["IV", "OI", "Vol", "Chg", "Premium", "", "Premium", "Chg", "Vol", "OI", "IV"].map((h, i) => (
                        <th key={i} style={{
                          padding: "6px 10px", color: COLORS.muted, fontWeight: 600, fontSize: 10,
                          textAlign: i === 5 ? "center" : i < 5 ? "right" : "left",
                          borderRight: i === 4 ? `1px solid ${COLORS.dim}` : undefined,
                          borderLeft: i === 6 ? `1px solid ${COLORS.dim}` : undefined,
                        }}>{h || "STRIKE"}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chain.map((row, i) => {
                      const atmStyle = row.atm ? { background: `${COLORS.accent}0A`, borderTop: `1px solid ${COLORS.accent}44`, borderBottom: `1px solid ${COLORS.accent}44` } : {};
                      return (
                        <tr key={row.strike} style={{
                          borderTop: `1px solid ${COLORS.border}`, cursor: "pointer", ...atmStyle,
                          transition: "background 0.1s",
                        }}
                          onMouseEnter={e => !row.atm && (e.currentTarget.style.background = COLORS.cardHover)}
                          onMouseLeave={e => !row.atm && (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "8px 10px", textAlign: "right", color: COLORS.muted }}>{row.callIV}%</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: COLORS.muted }}>{(row.callOI / 1000).toFixed(0)}K</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: COLORS.muted }}>{row.callVol.toLocaleString()}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: row.callChg >= 0 ? COLORS.green : COLORS.red, fontWeight: 600 }}>
                            {row.callChg >= 0 ? "+" : ""}{row.callChg}
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "right", borderRight: `1px solid ${COLORS.dim}` }}>
                            <span style={{ fontWeight: 700, color: COLORS.green }}>₹{row.callPrem}</span>
                          </td>
                          <td style={{
                            padding: "8px 14px", textAlign: "center", fontWeight: 800, fontSize: 13,
                            color: row.atm ? COLORS.accent : COLORS.text,
                            background: row.atm ? `${COLORS.accent}15` : undefined,
                          }}>
                            {row.strike.toLocaleString("en-IN")}
                            {row.atm && <div style={{ fontSize: 8, color: COLORS.accent }}>ATM</div>}
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "left", borderLeft: `1px solid ${COLORS.dim}` }}>
                            <span style={{ fontWeight: 700, color: COLORS.red }}>₹{row.putPrem}</span>
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "left", color: row.putChg >= 0 ? COLORS.green : COLORS.red, fontWeight: 600 }}>
                            {row.putChg >= 0 ? "+" : ""}{row.putChg}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "left", color: COLORS.muted }}>{row.putVol.toLocaleString()}</td>
                          <td style={{ padding: "8px 10px", textAlign: "left", color: COLORS.muted }}>{(row.putOI / 1000).toFixed(0)}K</td>
                          <td style={{ padding: "8px 10px", textAlign: "left", color: COLORS.muted }}>{row.putIV}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SCREENER TAB ── */}
        {tab === "Screener" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14 }}>
              {/* Filter Panel */}
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, alignSelf: "start" }}>
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🔍 Scanner Builder</div>
                {[
                  { label: "Signal Type", opts: ["All", "Premium Breakout", "Volume Spike", "OI Build-Up", "IV Expansion", "PCR Drop"] },
                  { label: "Instrument", opts: ["All", "CE", "PE", "Futures"] },
                  { label: "Expiry", opts: ["Current Week", "Next Week", "Monthly"] },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom: 12 }}>
                    <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 5 }}>{f.label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {f.opts.map(o => (
                        <button key={o} onClick={() => setScreenerFilter(o)} style={{
                          background: screenerFilter === o ? COLORS.accentGlow : COLORS.surface,
                          border: `1px solid ${screenerFilter === o ? COLORS.accent : COLORS.border}`,
                          color: screenerFilter === o ? COLORS.accent : COLORS.muted,
                          borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontWeight: 600,
                        }}>{o}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {[
                  { label: "Min Premium Chg%", val: "25" },
                  { label: "Min Volume", val: "5000" },
                  { label: "Min OI", val: "50000" },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom: 10 }}>
                    <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>{f.label}</div>
                    <input defaultValue={f.val} style={{
                      width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                      borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 12, boxSizing: "border-box",
                    }} />
                  </div>
                ))}
                <button style={{
                  width: "100%", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.purple})`,
                  border: "none", borderRadius: 7, padding: "9px", color: "#000", fontWeight: 800,
                  fontSize: 13, cursor: "pointer", marginTop: 6,
                }}>▶ Run Scanner</button>
              </div>

              {/* Results */}
              <div>
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>⚡ Scanner Results — Live</span>
                    <span style={{ background: COLORS.greenDim, color: COLORS.green, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                      {SCREENER_RESULTS.length} hits
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: COLORS.surface }}>
                        {["Contract", "Premium", "Chg%", "Volume", "OI", "IV", "Signal", "Chart"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", color: COLORS.muted, fontWeight: 600, fontSize: 11, textAlign: "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SCREENER_RESULTS.map((r, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background = COLORS.cardHover}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.sym}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>₹{r.premium}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              color: r.chg >= 0 ? COLORS.green : COLORS.red,
                              background: r.chg >= 0 ? COLORS.greenDim : COLORS.redDim,
                              padding: "2px 7px", borderRadius: 4, fontWeight: 700, fontSize: 11,
                            }}>+{r.chg}%</span>
                          </td>
                          <td style={{ padding: "10px 12px", color: COLORS.muted }}>{r.vol.toLocaleString()}</td>
                          <td style={{ padding: "10px 12px", color: COLORS.muted }}>{(r.oi / 1000).toFixed(0)}K</td>
                          <td style={{ padding: "10px 12px", color: COLORS.gold }}>{r.iv}%</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              background: COLORS.accentGlow, border: `1px solid ${COLORS.accent}44`,
                              color: COLORS.accent, borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                            }}>{r.signal}</span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <MiniCandles seed={i * 3 + 1} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── AI SIGNALS TAB ── */}
        {tab === "AI Signals" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{
              background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.cardHover})`,
              border: `1px solid ${COLORS.accent}33`,
              borderRadius: 10, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ fontSize: 28 }}>🤖</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.accent }}>QuantEdge AI — Trade Intelligence</div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>Real-time signal generation · 847 contracts scanned · Last updated 2s ago</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
              {AI_SIGNALS.map((s, i) => (
                <div key={s.sym} style={{
                  background: COLORS.card, border: `1px solid ${COLORS.border}`,
                  borderRadius: 10, padding: 16, overflow: "hidden", position: "relative",
                  borderLeft: `3px solid ${s.signal === "BUY" ? COLORS.green : s.signal === "SELL" ? COLORS.red : COLORS.gold}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{s.sym}</div>
                      <span style={{
                        background: s.type === "Breakout" ? `${COLORS.accent}22` : s.type === "Reversal" ? `${COLORS.red}22` : `${COLORS.purple}22`,
                        color: s.type === "Breakout" ? COLORS.accent : s.type === "Reversal" ? COLORS.red : COLORS.purple,
                        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      }}>{s.type}</span>
                    </div>
                    <span style={{
                      background: s.signal === "BUY" ? COLORS.greenDim : s.signal === "SELL" ? COLORS.redDim : `${COLORS.gold}22`,
                      color: s.signal === "BUY" ? COLORS.green : s.signal === "SELL" ? COLORS.red : COLORS.gold,
                      fontWeight: 800, fontSize: 14, padding: "4px 14px", borderRadius: 6,
                      border: `1px solid ${s.signal === "BUY" ? COLORS.green : s.signal === "SELL" ? COLORS.red : COLORS.gold}44`,
                    }}>{s.signal}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                    {[
                      { label: "Entry", val: `₹${s.entry.toLocaleString()}`, color: COLORS.accent },
                      { label: "Target", val: `₹${s.target.toLocaleString()}`, color: COLORS.green },
                      { label: "Stop Loss", val: `₹${s.sl.toLocaleString()}`, color: COLORS.red },
                    ].map(m => (
                      <div key={m.label} style={{ background: COLORS.surface, borderRadius: 6, padding: "7px 10px", textAlign: "center" }}>
                        <div style={{ color: COLORS.muted, fontSize: 10 }}>{m.label}</div>
                        <div style={{ color: m.color, fontWeight: 700, fontSize: 13 }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ color: COLORS.muted, fontSize: 11 }}>R:R </span>
                      <span style={{ color: COLORS.gold, fontWeight: 700 }}>{s.rr}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: COLORS.muted, fontSize: 11 }}>AI Confidence</span>
                      <div style={{ width: 80, height: 6, background: COLORS.dim, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          width: `${s.conf}%`, height: "100%",
                          background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.green})`,
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 12 }}>{s.conf}%</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <MiniCandles seed={i * 5 + 2} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CHARTS TAB ── */}
        {tab === "Charts" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["1m", "3m", "5m", "15m", "30m", "1h", "1D"].map(tf => (
                <button key={tf} style={{
                  background: tf === "5m" ? COLORS.accentGlow : COLORS.card,
                  border: `1px solid ${tf === "5m" ? COLORS.accent : COLORS.border}`,
                  color: tf === "5m" ? COLORS.accent : COLORS.muted,
                  borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600, fontSize: 12,
                }}>{tf}</button>
              ))}
              <div style={{ marginLeft: "auto", color: COLORS.muted, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>NIFTY 24400 CE</span>
                <span style={{ color: COLORS.accent, fontWeight: 700 }}>₹87.50</span>
                <span style={{ color: COLORS.green }}>+28.4%</span>
              </div>
            </div>
            {/* Premium Candlestick Display */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>📊 Premium Candlestick Chart — NIFTY 24400 CE</div>
              <svg width="100%" height="220" viewBox="0 0 800 220" style={{ overflow: "visible" }}>
                {/* Grid */}
                {[0, 55, 110, 165, 220].map(y => (
                  <line key={y} x1={0} y1={y} x2={800} y2={y} stroke={COLORS.border} strokeWidth="0.5" />
                ))}
                {/* Candles */}
                {Array.from({ length: 40 }, (_, idx) => {
                  const r = seededRand(idx * 17 + 3);
                  const x = 20 + idx * 19;
                  const o = 60 + r() * 120;
                  const c = o + (r() - 0.44) * 30;
                  const h = Math.max(o, c) + r() * 15;
                  const l = Math.min(o, c) - r() * 15;
                  const bull = c >= o;
                  const col = bull ? COLORS.green : COLORS.red;
                  const scaleY = y => y / 220 * 180 + 20;
                  return (
                    <g key={idx}>
                      <line x1={x + 6} y1={scaleY(h)} x2={x + 6} y2={scaleY(l)} stroke={col} strokeWidth="1" />
                      <rect x={x} y={scaleY(Math.max(o, c))} width={12} height={Math.max(2, Math.abs(scaleY(c) - scaleY(o)))}
                        fill={bull ? `${COLORS.green}40` : `${COLORS.red}40`} stroke={col} strokeWidth="1" rx="1" />
                    </g>
                  );
                })}
                {/* Volume bars */}
                {Array.from({ length: 40 }, (_, idx) => {
                  const r = seededRand(idx * 23 + 9);
                  const x = 20 + idx * 19;
                  const h = r() * 30;
                  const col = r() > 0.5 ? COLORS.green : COLORS.red;
                  return <rect key={idx} x={x} y={200 - h} width={12} height={h} fill={`${col}50`} rx="1" />;
                })}
              </svg>
            </div>

            {/* Multi-strike comparison */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { strike: "24300 CE", prem: 142.5, chg: 18.2 },
                { strike: "24400 CE", prem: 87.5, chg: 28.4 },
                { strike: "24500 CE", prem: 44.2, chg: 41.3 },
              ].map((s, i) => (
                <div key={s.strike} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{s.strike}</span>
                    <span style={{ color: COLORS.green, fontWeight: 700 }}>+{s.chg}%</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>₹{s.prem}</div>
                  <MiniCandles seed={i * 11 + 4} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer status bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`,
        padding: "6px 20px", display: "flex", gap: 20, alignItems: "center", fontSize: 11,
      }}>
        <span style={{ color: COLORS.green }}>● WebSocket Connected</span>
        <span style={{ color: COLORS.muted }}>Ping: 12ms</span>
        <span style={{ color: COLORS.muted }}>|</span>
        <span style={{ color: COLORS.muted }}>NSE: <span style={{ color: COLORS.green }}>Active</span></span>
        <span style={{ color: COLORS.muted }}>BSE: <span style={{ color: COLORS.green }}>Active</span></span>
        <span style={{ color: COLORS.muted }}>|</span>
        <span style={{ color: COLORS.muted }}>Ticks: {ticker * 10 + 847}</span>
        <span style={{ marginLeft: "auto", color: COLORS.muted }}>QuantEdge Pro v2.0 · Built for Indian Markets</span>
      </div>
      <div style={{ height: 30 }} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.surface}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.dim}; border-radius: 3px; }
        input:focus { outline: 1px solid ${COLORS.accent}; }
        button:focus { outline: none; }
      `}</style>
    </div>
  );
}
