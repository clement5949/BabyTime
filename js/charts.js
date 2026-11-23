// Tiny dependency-free SVG charts. Colours come from CSS classes in style.css.
const W = 320, H = 170, PL = 36, PR = 10, PT = 14, PB = 26;

function niceMax(v) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

// items: [{ label, v }]
export function bars(items, { cls = "bar-feed", labelEvery = 1, ref = null } = {}) {
  const max = niceMax(Math.max(...items.map((i) => i.v), ref || 0));
  const iw = (W - PL - PR) / items.length;
  const bw = Math.max(2, iw * 0.62);
  const y = (v) => PT + (H - PT - PB) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  [0, 0.5, 1].forEach((f) => {
    const v = max * f;
    s += `<line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    s += `<text x="${PL - 6}" y="${y(v) + 3}" class="axis" text-anchor="end">${Math.round(v)}</text>`;
  });
  if (ref) s += `<line x1="${PL}" x2="${W - PR}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}" class="ref"/>`;
  items.forEach((it, i) => {
    const x = PL + i * iw + (iw - bw) / 2;
    if (it.v > 0) {
      const h = (H - PT - PB) * (it.v / max);
      s += `<rect x="${x.toFixed(1)}" y="${y(it.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, bw / 2).toFixed(1)}" class="${cls}"/>`;
    }
    if (i % labelEvery === 0) {
      s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" class="axis" text-anchor="middle">${it.label}</text>`;
    }
  });
  return s + "</svg>";
}

// points: [{ t, v }] ascending by t. ref: optional horizontal reference line value.
export function line(points, { t0, t1, ref = null, dec = 1, cls = "line-weight", l0 = "", l1 = "" } = {}) {
  const vals = points.map((p) => p.v);
  if (ref != null) vals.push(ref);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 0.2) { lo -= 0.1; hi += 0.1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const x = (t) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
  const y = (v) => PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  [lo, (lo + hi) / 2, hi].forEach((v) => {
    s += `<line x1="${PL}" x2="${W - PR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/>`;
    s += `<text x="${PL - 6}" y="${(y(v) + 3).toFixed(1)}" class="axis" text-anchor="end">${v.toFixed(dec)}</text>`;
  });
  if (ref != null) {
    s += `<line x1="${PL}" x2="${W - PR}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}" class="ref"/>`;
  }
  if (points.length > 1) {
    const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    s += `<path d="${d}" class="${cls}-path" fill="none"/>`;
  }
  points.forEach((p, i) => {
    s += `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${points.length > 40 ? 2 : 3.5}" class="${cls}"/>`;
    if (i === points.length - 1) {
      const lx = Math.min(x(p.t), W - PR - 14);
      s += `<text x="${lx.toFixed(1)}" y="${(y(p.v) - 8).toFixed(1)}" class="val" text-anchor="middle">${p.v.toFixed(dec)}</text>`;
    }
  });
  s += `<text x="${PL}" y="${H - 8}" class="axis" text-anchor="start">${l0}</text>`;
  s += `<text x="${W - PR}" y="${H - 8}" class="axis" text-anchor="end">${l1}</text>`;
  return s + "</svg>";
}
