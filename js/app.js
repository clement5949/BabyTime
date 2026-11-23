import { t, getLang, setLang, locale } from "./i18n.js";
import { bars, line } from "./charts.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const DAY = 864e5;

// ───────────────────────── icons ─────────────────────────
const ICONS = {
  feed: '<path d="M10 3h4v3h-4z"/><path d="M8.5 6h7A1.5 1.5 0 0 1 17 7.5V9H7V7.5A1.5 1.5 0 0 1 8.5 6z"/><path d="M7 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M7 14h4M7 17h3"/>',
  pump: '<path d="M12 3c3.2 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 8.8 7 12 3z"/>',
  temp: '<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/>',
  weight: '<rect x="3.5" y="4" width="17" height="16" rx="4.5"/><path d="M8.5 10.5a3.5 3.5 0 0 1 7 0"/><path d="M12 10.5l1.8-1.8"/>',
  probiotic: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  spray: '<path d="M8 21v-8h6v8z"/><path d="M9 13V9h4v4"/><path d="M10.5 9V6h1v3"/><path d="M15.5 5.5h3M15.5 8l2.5 1M15.5 3l2.5-1"/>',
  home: '<path d="M3.5 11 12 4l8.5 7v8.5a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  history: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  trends: '<path d="M4 4v16h16"/><path d="M8 15l3-4 3 2 5-7"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// ───────────────────────── entry types ─────────────────────────
// To add a new thing to track later: add an entry here + a form in sheetHTML().
const TYPES = {
  feed: { cls: "k-feed", icon: "feed", title: (l) => (l.kind === "formula" ? t("formula") : t("breastMilk")), value: (l) => `${l.ml} ml` },
  pump: { cls: "k-pump", icon: "pump", title: () => t("pumpEntry"), value: (l) => `${l.ml} ml` },
  temp: { cls: "k-temp", icon: "temp", title: () => t("temp"), value: (l) => `${Number(l.c).toFixed(1)} °C` },
  weight: { cls: "k-weight", icon: "weight", title: () => t("weight"), value: (l) => `${Number(l.kg).toFixed(2)} kg` },
  probiotic: { cls: "k-probiotic", icon: "probiotic", title: () => t("probiotic"), value: () => "✓" },
  spray: { cls: "k-spray", icon: "spray", title: () => t("spray"), value: () => "✓" },
};
const QUICK = ["feed", "pump", "temp", "weight"];
const CARE = ["probiotic", "spray"];
const HIGH_TEMP = 38.0;

// ───────────────────────── state ─────────────────────────
let store;
let unsubs = [];
const S = {
  authReady: false, user: null, logs: [], timer: null,
  settings: { babyName: "", relaxMin: 5, burpMin: 10 },
  tab: "home", filter: "all", range: 7,
  sound: localStorage.getItem("bt_sound") !== "off",
  seen: null, pulse: false, dirty: false, err: "", family: null, justCreated: false,
};

// ───────────────────────── helpers ─────────────────────────
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const toLocalInput = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const timeStr = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });
const dayLabel = (ts) => {
  const d0 = startOfDay(Date.now()), k = startOfDay(ts);
  if (k === d0) return t("today");
  if (k === d0 - DAY) return t("yesterday");
  return new Date(ts).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
};
const whenStr = (ts) => (startOfDay(ts) === startOfDay(Date.now()) ? timeStr(ts) : `${dayLabel(ts)} ${timeStr(ts)}`);
const byName = (e) => String(e || "").split("@")[0];
const myName = () => localStorage.getItem("bt_me") || "";

// Private link = the app address + #k=<secret code>. The code is the key to the data.
const FAM_KEY = "bt_family";
const newCode = () => {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const parseCode = (s) => {
  const raw = String(s || "");
  const m = raw.match(/[#?&]k=([A-Za-z0-9_-]+)/);
  const c = m ? m[1] : raw.trim();
  return /^[A-Za-z0-9_-]{24,}$/.test(c) ? c : "";
};
const familyLink = () => `${location.origin}${location.pathname}#k=${S.family}`;
function loadFamily() {
  const code = parseCode(location.hash) || parseCode(localStorage.getItem(FAM_KEY));
  if (!code) return null;
  S.family = code;
  localStorage.setItem(FAM_KEY, code);
  // Keep the code in the address so "Add to Home Screen" captures it.
  history.replaceState(null, "", familyLink());
  return code;
}
function copyLink() {
  const link = familyLink();
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
    .then(() => toast(t("copied")))
    .catch(() => toast(link, 8000));
}
function shareLink() {
  if (navigator.share) navigator.share({ title: t("appName"), url: familyLink() }).catch(() => {});
  else copyLink();
}
const dur = (ms) => {
  const m = Math.floor(ms / 60000);
  if (m < 1) return null;
  const h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return t("dh", { d, h: h % 24 });
  if (h >= 1) return t("hm", { h, m: m % 60 });
  return t("mOnly", { m });
};
const agoStr = (ts) => { const x = dur(Date.now() - ts); return x ? t("ago", { t: x }) : t("justNow"); };
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const lastOf = (type) => S.logs.find((l) => l.type === type);
const sumMl = (arr) => arr.reduce((s, l) => s + (Number(l.ml) || 0), 0);

let toastTimer;
function toast(msg, ms = 2400, action = null) {
  const el = $("#toast");
  el.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.className = "toast-btn";
    b.dataset.act = action.act;
    b.textContent = action.label;
    el.append(" ", b);
  }
  el.classList.toggle("has-action", Boolean(action));
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

// ───────────────────────── timer logic ─────────────────────────
// A timer is just 3 timestamps stored in the database, so both phones show the same
// countdown and nothing is lost if the app is closed.
const phaseOf = (tm, now = Date.now()) => {
  if (!tm) return null;
  if (now < tm.relaxEndsAt) return "relax";
  if (now < tm.burpEndsAt) return "burp";
  return "done";
};

function startTimer() {
  const now = Date.now();
  const r = Number(S.settings.relaxMin) || 0, b = Number(S.settings.burpMin) || 0;
  store.setTimer({ id: now, relaxEndsAt: now + r * 60000, burpEndsAt: now + (r + b) * 60000, relaxMin: r, burpMin: b, by: myName() });
}
function skipRelax() {
  const tm = S.timer; if (!tm) return;
  const now = Date.now();
  if (S.seen) S.seen.phase = "burp"; // no chime for a skip we did ourselves
  store.setTimer({ ...tm, relaxEndsAt: now, burpEndsAt: now + (Number(tm.burpMin) || 0) * 60000 });
}
function syncSeen() {
  if (!S.timer) { S.seen = null; return; }
  if (!S.seen || S.seen.id !== S.timer.id) S.seen = { id: S.timer.id, phase: phaseOf(S.timer) };
}

// Audio: chimes are pre-rendered into small WAV clips and played through one <audio>
// element. Unlike Web Audio, this still plays on iPhone when the silent switch is on.
const CHIME = { burp: [[659, 0.28], [880, 0.28], [1175, 0.7]], done: [[784, 0.3], [659, 0.3], [523, 0.9]] };

function makeWav(notes, repeats, gapSec) {
  const sr = 22050, seq = [];
  for (let r = 0; r < repeats; r++) {
    for (const [f, d] of notes) {
      const n = Math.floor(d * sr);
      for (let i = 0; i < n; i++) {
        const tt = i / sr;
        seq.push(Math.sin(2 * Math.PI * f * tt) * 0.6 * Math.min(1, tt / 0.02) * Math.exp((-3.2 * tt) / d));
      }
    }
    for (let i = 0, g = Math.floor(gapSec * sr); i < g; i++) seq.push(0);
  }
  const n = seq.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, seq[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

const player = new Audio();
player.preload = "auto";
let clips = null, audioReady = false;

function prepAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
  clips = clips || {
    burp: makeWav(CHIME.burp, 2, 0.5),
    done: makeWav(CHIME.done, 2, 0.5),
    silent: makeWav([[0, 0.1]], 1, 0),
  };
}
// iPhones only allow sound after a tap, so the first tap anywhere "unlocks" the player.
function unlockAudio() {
  if (audioReady) return;
  try {
    prepAudio();
    player.src = clips.silent;
    const p = player.play();
    if (p && p.then) p.then(() => { audioReady = true; }).catch(() => {});
  } catch {}
}
async function chime(kind) {
  if (!S.sound) return false;
  try {
    prepAudio();
    player.src = clips[kind];
    player.currentTime = 0;
    await player.play();
    audioReady = true;
    return true;
  } catch (e) {
    console.warn("[audio]", e);
    return false;
  }
}

function alertPhase(p) {
  chime(p === "burp" ? "burp" : "done");
  if (navigator.vibrate) navigator.vibrate(p === "burp" ? [300, 150, 300] : [500, 200, 500, 200, 500]);
  toast(p === "burp" ? t("burpNow") : t("allDone"), 5000);
  S.pulse = true;
  setTimeout(() => (S.pulse = false), 4500);
}

// keep the screen on while a countdown is running
let wl = null, wlBusy = false;
async function syncWake() {
  if (wlBusy || !("wakeLock" in navigator)) return;
  const need = S.timer && phaseOf(S.timer) !== "done" && document.visibilityState === "visible";
  wlBusy = true;
  try {
    if (need && !wl) {
      wl = await navigator.wakeLock.request("screen");
      wl.addEventListener("release", () => { wl = null; });
    } else if (!need && wl) {
      await wl.release(); wl = null;
    }
  } catch { wl = null; }
  wlBusy = false;
}

const RING = 2 * Math.PI * 88;
function tick() {
  const tm = S.timer;
  if (tm && S.user) {
    const now = Date.now(), p = phaseOf(tm, now);
    if (S.seen && S.seen.id === tm.id && S.seen.phase !== p) {
      S.seen.phase = p;
      alertPhase(p);
      if (S.tab !== "settings") render(true);
      return;
    }
    const el = $("#tm");
    if (el && el.dataset.phase !== p) { render(true); return; }
    if (el && p !== "done") {
      const end = p === "relax" ? tm.relaxEndsAt : tm.burpEndsAt;
      const start = p === "relax" ? tm.id : tm.relaxEndsAt;
      const total = Math.max(1, end - start), left = Math.max(0, end - now);
      const tEl = $("#tm-time"), rEl = $("#tm-ring");
      if (tEl) tEl.textContent = mmss(left);
      if (rEl) rEl.setAttribute("stroke-dashoffset", String(RING * (1 - left / total)));
    }
  }
  syncWake();
}

// ───────────────────────── views ─────────────────────────
function logRow(l) {
  const T = TYPES[l.type];
  if (!T) return "";
  const high = l.type === "temp" && Number(l.c) >= HIGH_TEMP ? `<span class="badge">${t("high")}</span>` : "";
  const sub = [whenStr(l.ts), byName(l.by), l.note].filter(Boolean).join(" · ");
  return `<button class="item" data-act="entry" data-id="${esc(l.id)}">
    <span class="ico ${T.cls}">${svg(T.icon)}</span>
    <span class="main"><span class="ttl">${esc(T.title(l))}${high}</span><span class="sub">${esc(sub)}</span></span>
    <span class="val">${esc(T.value(l))}</span>
  </button>`;
}

function timerCard() {
  const tm = S.timer;
  if (!tm) {
    return `<section class="hero" id="tm" data-phase="none">
      <div class="eyebrow">${t("feedTimer")}</div>
      <h3>${t("relaxPhase")} → ${t("burpPhase")}</h3>
      <p>${t("timerPlan", { a: S.settings.relaxMin, b: S.settings.burpMin })}</p>
      <div class="row"><button class="hbtn" data-act="timer-start">${t("start")}</button></div>
    </section>`;
  }
  const p = phaseOf(tm);
  const pulse = S.pulse ? " pulse" : "";
  if (p === "done") {
    return `<section class="hero center${pulse}" id="tm" data-phase="done">
      <div class="eyebrow">${t("feedTimer")}</div>
      <h3>${t("donePhase")}</h3><p>${t("doneDesc")}</p>
      <div class="row"><button class="hbtn" data-act="timer-clear">${t("dismiss")}</button></div>
    </section>`;
  }
  return `<section class="hero center${pulse}" id="tm" data-phase="${p}">
    <div class="eyebrow">${t("feedTimer")}</div>
    <h3>${p === "relax" ? t("relaxPhase") : t("burpPhase")}</h3>
    <div class="ringbox">
      <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="ring-bg" cx="100" cy="100" r="88"/>
        <circle id="tm-ring" class="ring-fg" cx="100" cy="100" r="88" transform="rotate(-90 100 100)" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="0"/>
      </svg>
      <div class="t"><b id="tm-time">--:--</b></div>
    </div>
    <p>${p === "relax" ? t("relaxDesc") : t("burpDesc")}</p>
    <div class="row">
      ${p === "relax" ? `<button class="hbtn ghost" data-act="timer-skip">${t("skip")}</button>` : ""}
      <button class="hbtn ghost" data-act="timer-clear">${t("stop")}</button>
    </div>
  </section>`;
}

function shareBanner() {
  return `<div class="card">
    <div class="ctitle">${t("sendLinkTitle")}</div>
    <p style="color:var(--muted);font-size:14px;margin:0 0 14px">${t("sendLinkDesc")}</p>
    <div class="row2"><button class="btn ghost" data-act="copy-link">${t("copy")}</button><button class="btn" data-act="share-link">${t("share")}</button></div>
    <button class="link" data-act="dismiss-share">${t("dismiss")}</button>
  </div>`;
}

function careList() {
  const d0 = startOfDay(Date.now());
  return CARE.map((k) => {
    const last = lastOf(k);
    const n = S.logs.filter((l) => l.type === k && l.ts >= d0).length;
    const sub = last ? `${t("todayN", { n })} · ${agoStr(last.ts)}` : t("none");
    return `<button class="item" data-act="quick" data-v="${k}">
      <span class="ico ${TYPES[k].cls}">${svg(TYPES[k].icon)}</span>
      <span class="main"><span class="ttl">${t(k)}</span><span class="sub">${esc(sub)}</span></span>
      <span class="pill">+ ${t("logNow")}</span>
    </button>`;
  }).join("");
}

function homeView() {
  const now = Date.now(), d0 = startOfDay(now);
  const today = S.logs.filter((l) => l.ts >= d0);
  const feeds = today.filter((l) => l.type === "feed"), pumps = today.filter((l) => l.type === "pump");
  const lf = lastOf("feed");
  const date = new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });

  const lastText = (type) => {
    const l = lastOf(type);
    if (!l) return t("none");
    const v = TYPES[type].value(l);
    return type === "feed" || type === "pump" ? `${v} · ${agoStr(l.ts)}` : v;
  };
  const tiles = QUICK.map((k) => `
    <button class="tile" data-act="open" data-v="${k}">
      <span class="ico ${TYPES[k].cls}">${svg(TYPES[k].icon)}</span>
      <span><span class="name" style="display:block">${t(k)}</span><span class="lastv" style="display:block">${esc(lastText(k))}</span></span>
    </button>`).join("");

  const recent = S.logs.filter((l) => TYPES[l.type]).slice(0, 5);
  return `
    <div class="top"><div><div class="sub">${esc(date)}</div><h1>${esc(S.settings.babyName || t("appName"))}</h1></div></div>
    <div class="stack">
      ${S.justCreated && S.family ? shareBanner() : ""}
      ${timerCard()}
      <div class="grid2">${tiles}</div>
      <div class="list">${careList()}</div>
      <div class="grid2">
        <div class="card stat">
          <div class="label">${t("milkToday")}</div>
          <div class="big">${sumMl(feeds)}<small>ml</small></div>
          <div class="meta">${t("feedsCount", { n: feeds.length })}</div>
          <div class="meta">${lf ? `${t("lastFeed")}: ${agoStr(lf.ts)}` : t("noFeedYet")}</div>
        </div>
        <div class="card stat">
          <div class="label">${t("pumpedToday")}</div>
          <div class="big">${sumMl(pumps)}<small>ml</small></div>
          <div class="meta">${t("pumpsCount", { n: pumps.length })}</div>
        </div>
      </div>
    </div>
    <div class="h2"><h2>${t("recent")}</h2><button data-act="tab" data-v="history">${t("seeAll")}</button></div>
    <div class="list">${recent.length ? recent.map(logRow).join("") : `<div class="empty">${t("nothingYet")}</div>`}</div>`;
}

function historyView() {
  const f = S.filter;
  const chips = [["all", "all"], ["feed", "feeds"], ["pump", "pumps"], ["temp", "temps"], ["weight", "weights"], ["care", "care"]]
    .map(([k, lab]) => `<button class="chip${f === k ? " on" : ""}" data-act="filter" data-v="${k}">${t(lab)}</button>`).join("");
  const list = S.logs.filter((l) => TYPES[l.type] && (f === "all" || l.type === f || (f === "care" && CARE.includes(l.type))));
  const groups = [];
  for (const l of list) {
    const k = dayKey(l.ts);
    let g = groups[groups.length - 1];
    if (!g || g.k !== k) { g = { k, ts: l.ts, items: [] }; groups.push(g); }
    g.items.push(l);
  }
  const body = groups.map((g) => {
    const all = S.logs.filter((l) => dayKey(l.ts) === g.k);
    const totals = t("dayTotals", { a: sumMl(all.filter((l) => l.type === "feed")), b: sumMl(all.filter((l) => l.type === "pump")) });
    return `<div class="dayhead"><b>${dayLabel(g.ts)}</b><span>${totals}</span></div><div class="list">${g.items.map(logRow).join("")}</div>`;
  }).join("");
  return `<div class="top"><h1>${t("tabHistory")}</h1></div>
    <div class="chips">${chips}</div>
    ${body || `<div class="empty">${t("nothingYet")}</div>`}`;
}

function trendsView() {
  const n = S.range, now = Date.now();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    days.push({ d, k: dayKey(d.getTime()), feed: 0, pump: 0 });
  }
  const byKey = new Map(days.map((x) => [x.k, x]));
  for (const l of S.logs) {
    const x = byKey.get(dayKey(l.ts));
    if (x && (l.type === "feed" || l.type === "pump")) x[l.type] += Number(l.ml) || 0;
  }
  const label = (x) => n <= 7 ? x.d.toLocaleDateString(locale(), { weekday: "short" }) : `${x.d.getDate()}/${x.d.getMonth() + 1}`;
  const every = n <= 7 ? 1 : n <= 30 ? 5 : 15;
  const feedItems = days.map((x) => ({ label: label(x), v: x.feed }));
  const pumpItems = days.map((x) => ({ label: label(x), v: x.pump }));

  const t0 = days[0].d.getTime();
  const short = (ts) => new Date(ts).toLocaleDateString(locale(), { day: "numeric", month: "short" });
  const pts = (type, key) => S.logs.filter((l) => l.type === type && l.ts >= t0 && Number(l[key]) > 0)
    .map((l) => ({ t: l.ts, v: Number(l[key]) })).sort((a, b) => a.t - b.t);
  const wp = pts("weight", "kg"), tp = pts("temp", "c");
  const card = (title, inner) => `<div class="card"><div class="ctitle">${title}</div>${inner}</div>`;
  const noData = `<div class="empty">${t("noData")}</div>`;
  const hasFeed = feedItems.some((i) => i.v > 0), hasPump = pumpItems.some((i) => i.v > 0);

  const chips = [7, 30, 90].map((r) => `<button class="chip${n === r ? " on" : ""}" data-act="range" data-v="${r}">${t("d" + r)}</button>`).join("");
  return `<div class="top"><h1>${t("tabTrends")}</h1></div>
    <div class="chips" style="margin-bottom:16px">${chips}</div>
    <div class="stack">
      ${card(t("milkPerDay"), hasFeed ? bars(feedItems, { cls: "bar-feed", labelEvery: every }) : noData)}
      ${card(t("pumpPerDay"), hasPump ? bars(pumpItems, { cls: "bar-pump", labelEvery: every }) : noData)}
      ${card(t("weightTrend"), wp.length ? line(wp, { t0, t1: now, dec: 2, cls: "line-weight", l0: short(t0), l1: short(now) }) : noData)}
      ${card(t("tempTrend"), tp.length ? line(tp, { t0, t1: now, ref: HIGH_TEMP, dec: 1, cls: "line-temp", l0: short(t0), l1: short(now) }) : noData)}
    </div>`;
}

function settingsView() {
  const st = S.settings, lang = getLang();
  const seg = (act, items) => `<div class="seg">${items.map(([v, lab, on]) => `<button type="button" class="${on ? "on" : ""}" data-act="${act}" data-v="${v}">${lab}</button>`).join("")}</div>`;
  return `<div class="top"><h1>${t("tabSettings")}</h1></div>
    <div class="stack">
      <div class="card">
        <label class="field"><span>${t("babyName")}</span><input class="input" data-set="babyName" value="${esc(st.babyName)}" maxlength="30" autocomplete="off"></label>
        <div class="row2" style="margin-bottom:0">
          <label class="field" style="margin:0"><span>${t("relaxMin")}</span><input class="input" type="number" inputmode="numeric" min="0" max="60" data-set="relaxMin" value="${esc(st.relaxMin)}"></label>
          <label class="field" style="margin:0"><span>${t("burpMin")}</span><input class="input" type="number" inputmode="numeric" min="1" max="60" data-set="burpMin" value="${esc(st.burpMin)}"></label>
        </div>
      </div>
      <div class="card">
        <div class="field"><span>${t("language")}</span>${seg("lang", [["en", "English", lang === "en"], ["zh", "中文", lang === "zh"]])}</div>
        <div class="field" style="margin-bottom:12px"><span>${t("sound")}</span>${seg("sound", [["on", t("on"), S.sound], ["off", t("off"), !S.sound]])}</div>
        <button class="btn ghost" data-act="test-sound">${t("testSound")}</button>
      </div>
      <div class="card">
        <label class="field"><span>${t("yourName")}</span><input class="input" data-set="myName" value="${esc(myName())}" maxlength="20" autocomplete="off"></label>
        ${store.needsFamily && S.family ? `
        <div class="field" style="margin-bottom:12px"><span>${t("privateLink")}</span><div class="linkbox">${esc(familyLink())}</div></div>
        <div class="row2"><button class="btn ghost" data-act="copy-link">${t("copy")}</button><button class="btn ghost" data-act="share-link">${t("share")}</button></div>
        <p style="color:var(--muted);font-size:13px;margin:12px 0 0">${t("privateLinkDesc")}</p>
        <button class="link" data-act="leave-space">${t("leaveSpace")}</button>` : ""}
      </div>
      <p style="color:var(--muted);font-size:13px;margin:4px 4px 0">${t("timerNote")}</p>
    </div>`;
}

function welcomeView() {
  return `<div class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1>${t("appName")}</h1>
    <p style="color:var(--muted);margin:-12px 0 24px">${t("welcomeDesc")}</p>
    ${S.err ? `<div class="err">${esc(S.err)}</div>` : ""}
    <button class="btn" data-act="create-space">${t("createSpace")}</button>
    <form id="join-form" style="margin-top:32px">
      <label class="field"><span>${t("joinLabel")}</span><input class="input" name="code" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…#k=…"></label>
      <button class="btn ghost" type="submit">${t("join")}</button>
    </form>
    <button type="button" class="link" data-act="lang" data-v="${getLang() === "en" ? "zh" : "en"}">${getLang() === "en" ? "中文" : "English"}</button>
  </div>`;
}

function connectErrView() {
  return `<div class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1>${t("appName")}</h1>
    <div class="err">${esc(S.err || t("connectErr"))}</div>
    <button class="btn" data-act="retry">${t("retry")}</button>
  </div>`;
}

function tabbar() {
  const tabs = [["home", "tabHome"], ["history", "tabHistory"], ["trends", "tabTrends"], ["settings", "tabSettings"]];
  return `<div class="tabbar"><nav>${tabs.map(([k, lab]) =>
    `<button class="tab${S.tab === k ? " on" : ""}" data-act="tab" data-v="${k}">${svg(k)}<span>${t(lab)}</span></button>`).join("")}</nav></div>`;
}

// ───────────────────────── render ─────────────────────────
const isTyping = () => {
  const a = document.activeElement;
  return a && a.closest && a.closest("#app") && ["INPUT", "SELECT", "TEXTAREA"].includes(a.tagName);
};

function render(force = false) {
  if (!force && isTyping()) { S.dirty = true; return; }
  S.dirty = false;
  const app = $("#app");
  if (!S.authReady) { app.innerHTML = ""; return; }
  if (store.needsFamily && !S.family) { app.innerHTML = welcomeView(); return; }
  if (!S.user) { app.innerHTML = connectErrView(); return; }
  const views = { home: homeView, history: historyView, trends: trendsView, settings: settingsView };
  const banner = store.mode === "local" ? `<div class="banner">${t("demoBanner")}</div>` : "";
  const y = window.scrollY;
  app.innerHTML = `<div class="wrap">${banner}${(views[S.tab] || homeView)()}</div>${tabbar()}`;
  window.scrollTo(0, y);
  tick();
}

// ───────────────────────── sheets ─────────────────────────
function closeSheet() { $("#sheet-root").innerHTML = ""; }

function sheetHTML(type) {
  const T = TYPES[type];
  const last = lastOf(type);
  let fields = "";
  if (type === "feed") {
    fields += `<div class="seg"><button type="button" class="on" data-act="kind" data-v="breast">${t("breastMilk")}</button><button type="button" data-act="kind" data-v="formula">${t("formula")}</button></div><input type="hidden" name="kind" value="breast">`;
  }
  if (type === "feed" || type === "pump") {
    const amts = type === "feed" ? [60, 90, 120, 150] : [60, 100, 150, 200];
    fields += `<div class="field"><span>${t("amountMl")}</span>
      <input class="input" name="ml" type="number" inputmode="numeric" min="1" max="1000" step="1" required placeholder="0" value="${last ? esc(last.ml) : ""}" aria-label="${t("amountMl")}">
      <div class="amts">${amts.map((a) => `<button type="button" class="chip" data-act="amt" data-v="${a}">${a}</button>`).join("")}</div></div>`;
  }
  if (type === "temp") fields += `<label class="field"><span>${t("tempC")}</span><input class="input" name="c" type="number" inputmode="decimal" min="30" max="45" step="0.1" required placeholder="36.8"></label>`;
  if (type === "weight") fields += `<label class="field"><span>${t("weightKg")}</span><input class="input" name="kg" type="number" inputmode="decimal" min="0.5" max="30" step="0.01" required placeholder="4.50"></label>`;
  fields += `<label class="field"><span>${t("when")}</span><input class="input" name="when" type="datetime-local" required value="${toLocalInput(Date.now())}"></label>`;
  fields += `<label class="field"><span>${t("note")}</span><textarea class="input" name="note" maxlength="200"></textarea></label>`;
  if (type === "feed") fields += `<label class="check"><input type="checkbox" name="startTimer" checked> ${t("startTimerAfter")}</label>`;
  return `<div class="backdrop" data-act="close"></div>
    <form class="sheet" id="sheet-form" data-type="${type}">
      <div class="grab"></div>
      <h3><span class="ico ${T.cls}">${svg(T.icon)}</span>${t(type)}</h3>
      ${fields}
      <button class="btn" type="submit">${t("save")}</button>
      <button class="link" type="button" data-act="close">${t("cancel")}</button>
    </form>`;
}

function entrySheet(id) {
  const l = S.logs.find((x) => x.id === id);
  if (!l || !TYPES[l.type]) return;
  const T = TYPES[l.type];
  const rows = [[whenStr(l.ts), ""], [byName(l.by), ""], [l.note || "", ""]].filter((r) => r[0]);
  $("#sheet-root").innerHTML = `<div class="backdrop" data-act="close"></div>
    <div class="sheet">
      <div class="grab"></div>
      <h3><span class="ico ${T.cls}">${svg(T.icon)}</span>${esc(T.title(l))}</h3>
      <div class="stat" style="margin-bottom:20px">
        <div class="big">${esc(T.value(l))}</div>
        ${rows.map((r) => `<div class="meta" style="font-size:15px;margin-top:6px">${esc(r[0])}</div>`).join("")}
      </div>
      <label class="field"><span>${t("editTime")}</span><input class="input" id="entry-when" type="datetime-local" value="${toLocalInput(l.ts)}"></label>
      <button class="btn" data-act="save-time" data-id="${esc(l.id)}" style="margin-bottom:12px">${t("saveTime")}</button>
      <button class="btn danger" data-act="del" data-id="${esc(l.id)}">${t("del")}</button>
      <button class="link" data-act="close">${t("cancel")}</button>
    </div>`;
}

function openSheet(type) {
  $("#sheet-root").innerHTML = sheetHTML(type);
  const el = $("#sheet-form input[name=ml], #sheet-form input[name=c], #sheet-form input[name=kg]");
  if (el && !el.value) setTimeout(() => el.focus(), 120);
}

function quickLog(type) {
  const now = Date.now();
  if (S.q && S.q.type === type && now - S.q.t < 4000) return; // ignore accidental double-tap
  S.q = { type, t: now };
  unlockAudio();
  S.undoId = store.addLog({ type, ts: now, by: myName() });
  toast(t(type === "probiotic" ? "loggedProbiotic" : "loggedSpray"), 6000, { act: "undo", label: t("undo") });
  if (navigator.vibrate) navigator.vibrate(30);
}

function doSave(f) {
  if (!f.reportValidity()) return;
  unlockAudio();
  const type = f.dataset.type, fd = new FormData(f);
  const ts = new Date(fd.get("when")).getTime();
  if (!Number.isFinite(ts)) return;
  const log = { type, ts, by: myName() };
  if (type === "feed") { log.kind = fd.get("kind") === "formula" ? "formula" : "breast"; log.ml = Number(fd.get("ml")); }
  if (type === "pump") log.ml = Number(fd.get("ml"));
  if (type === "temp") log.c = Number(fd.get("c"));
  if (type === "weight") log.kg = Number(fd.get("kg"));
  const note = String(fd.get("note") || "").trim();
  if (note) log.note = note;
  store.addLog(log);
  closeSheet();
  toast(t("saved"));
  if (type === "feed" && fd.get("startTimer")) startTimer();
}

function setFamily(code) {
  S.family = code;
  S.err = "";
  S.tab = "home";
  localStorage.setItem(FAM_KEY, code);
  history.replaceState(null, "", familyLink());
  boot();
}

function doJoin(f) {
  const code = parseCode(new FormData(f).get("code"));
  if (!code) { S.err = t("invalidCode"); render(true); return; }
  if (document.activeElement) document.activeElement.blur();
  setFamily(code);
}

// ───────────────────────── events ─────────────────────────
document.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  switch (act) {
    case "tab": S.tab = v; window.scrollTo(0, 0); render(true); break;
    case "filter": S.filter = v; render(true); break;
    case "range": S.range = Number(v); render(true); break;
    case "open": openSheet(v); break;
    case "entry": entrySheet(el.dataset.id); break;
    case "close": closeSheet(); break;
    case "kind": {
      el.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el));
      $("#sheet-form input[name=kind]").value = v; break;
    }
    case "amt": { const i = $("#sheet-form input[name=ml]"); i.value = v; break; }
    case "quick": quickLog(v); break;
    case "undo":
      if (S.undoId) { store.deleteLog(S.undoId); S.undoId = null; S.q = null; }
      $("#toast").classList.remove("show");
      break;
    case "save-time": {
      const ts = new Date($("#entry-when").value).getTime();
      if (Number.isFinite(ts)) { store.updateLog(el.dataset.id, { ts }); closeSheet(); toast(t("saved")); }
      break;
    }
    case "timer-start": unlockAudio(); startTimer(); break;
    case "timer-skip": skipRelax(); break;
    case "timer-clear": store.clearTimer(); break;
    case "lang": setLang(v); render(true); break;
    case "sound":
      S.sound = v === "on"; localStorage.setItem("bt_sound", v);
      if (S.sound) chime("burp");
      render(true); break;
    case "test-sound":
      if (navigator.vibrate) navigator.vibrate(200);
      chime("burp").then((ok) => { if (!ok) toast(S.sound ? t("soundBlocked") : t("soundOffNote"), 5000); });
      break;
    case "create-space": S.justCreated = true; setFamily(newCode()); break;
    case "copy-link": copyLink(); break;
    case "share-link": shareLink(); break;
    case "dismiss-share": S.justCreated = false; render(true); break;
    case "retry": S.err = ""; boot(); break;
    case "leave-space":
      if (confirm(t("leaveConfirm"))) {
        localStorage.removeItem(FAM_KEY);
        S.family = null; S.justCreated = false; S.tab = "home";
        history.replaceState(null, "", location.pathname);
        boot();
      }
      break;
    case "del":
      if (confirm(t("confirmDelete"))) { store.deleteLog(el.dataset.id); closeSheet(); toast(t("deleted")); }
      break;
  }
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "join-form") doJoin(e.target);
  else if (e.target.id === "sheet-form") doSave(e.target);
});

document.addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.set;
  if (!k) return;
  let v = e.target.value;
  if (k === "myName") { // stored on this phone only
    localStorage.setItem("bt_me", v.trim());
    toast(t("settingsSaved"));
    return;
  }
  if (k === "relaxMin" || k === "burpMin") {
    v = Math.max(k === "burpMin" ? 1 : 0, Math.min(60, Math.round(Number(v) || 0)));
    e.target.value = v;
  } else v = v.trim();
  S.settings = { ...S.settings, [k]: v };
  store.saveSettings({ [k]: v });
  toast(t("settingsSaved"));
});

document.addEventListener("focusout", () => {
  setTimeout(() => { if (S.dirty && !isTyping()) render(); }, 50);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { tick(); render(); }
  syncWake();
});

// ───────────────────────── boot ─────────────────────────
function startSync() {
  const since = Date.now() - 90 * DAY;
  // The Settings screen shows neither logs nor the timer, so don't redraw it for them
  // (a redraw mid-tap can swallow the tap).
  const redraw = () => { if (S.tab !== "settings") render(); };
  unsubs = [
    store.watchLogs(since, (logs) => { S.logs = logs; redraw(); }),
    store.watchTimer((tm) => { S.timer = tm; syncSeen(); redraw(); }),
    store.watchSettings((s) => {
      const next = { ...S.settings, ...(s || {}) };
      if (JSON.stringify(next) === JSON.stringify(S.settings)) return;
      S.settings = next;
      render();
    }),
  ];
}

let stopAuth = () => {};
function boot() {
  stopAuth();
  unsubs.forEach((f) => f && f()); unsubs = [];
  S.logs = []; S.timer = null; S.seen = null; S.user = null;
  if (store.needsFamily && !S.family) { S.authReady = true; render(true); return; }
  if (store.needsFamily) store.setFamily(S.family);
  S.authReady = false;
  render(true);
  stopAuth = store.onAuth(
    (u) => {
      S.authReady = true; S.user = u; S.err = "";
      unsubs.forEach((f) => f && f()); unsubs = [];
      if (u) startSync();
      render(true);
    },
    (e) => { console.error(e); S.err = t("connectErr"); S.authReady = true; S.user = null; render(true); }
  );
}

async function init() {
  try {
    store = await import("./store.js");
  } catch (e) {
    console.error(e);
    $("#app").innerHTML = `<div class="login"><h1>${t("appName")}</h1><p class="err">Couldn't load. Check your connection and Firebase config, then reload.</p></div>`;
    return;
  }
  S.family = store.needsFamily ? loadFamily() : null;
  boot();
  setInterval(tick, 250);
  setInterval(() => { if (S.tab === "home" && S.user) render(); }, 30000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
