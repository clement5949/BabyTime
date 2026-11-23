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
};
const QUICK = ["feed", "pump", "temp", "weight"];
const HIGH_TEMP = 38.0;

// ───────────────────────── state ─────────────────────────
let store;
let unsubs = [];
const S = {
  authReady: false, user: null, logs: [], timer: null,
  settings: { babyName: "", relaxMin: 5, burpMin: 10 },
  tab: "home", filter: "all", range: 7,
  sound: localStorage.getItem("bt_sound") !== "off",
  seen: null, pulse: false, dirty: false, err: "", loginEmail: "",
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
function toast(msg, ms = 2400) {
  const el = $("#toast");
  el.textContent = msg;
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
  store.setTimer({ id: now, relaxEndsAt: now + r * 60000, burpEndsAt: now + (r + b) * 60000, relaxMin: r, burpMin: b, by: S.user.email });
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

// audio (must be unlocked by a tap on iOS)
let actx;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch {}
}
function chime(notes) {
  if (!actx || !S.sound) return;
  let at = actx.currentTime + 0.03;
  for (const [f, d] of notes) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.28, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, at + d);
    o.connect(g).connect(actx.destination);
    o.start(at); o.stop(at + d + 0.05);
    at += d * 0.85;
  }
}
const CHIME = { burp: [[659, 0.28], [880, 0.28], [1175, 0.7]], done: [[784, 0.3], [659, 0.3], [523, 0.9]] };
function alertPhase(p) {
  const notes = p === "burp" ? CHIME.burp : CHIME.done;
  chime(notes);
  setTimeout(() => chime(notes), 1500);
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
      ${timerCard()}
      <div class="grid2">${tiles}</div>
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
  const chips = [["all", "all"], ["feed", "feeds"], ["pump", "pumps"], ["temp", "temps"], ["weight", "weights"]]
    .map(([k, lab]) => `<button class="chip${f === k ? " on" : ""}" data-act="filter" data-v="${k}">${t(lab)}</button>`).join("");
  const list = S.logs.filter((l) => TYPES[l.type] && (f === "all" || l.type === f));
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
        <div class="sub" style="color:var(--muted);font-size:14px;margin-bottom:12px">${t("account", { e: esc(S.user.email) })}</div>
        ${store.mode === "firebase" ? `<button class="btn ghost" data-act="signout">${t("signOut")}</button>` : ""}
      </div>
      <p style="color:var(--muted);font-size:13px;margin:4px 4px 0">${t("timerNote")}</p>
    </div>`;
}

function loginView() {
  return `<form class="login" id="login-form" autocomplete="on">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1>${t("appName")}</h1>
    <label class="field"><span>${t("email")}</span><input class="input" name="email" type="email" autocomplete="username" required value="${esc(S.loginEmail)}"></label>
    <label class="field"><span>${t("password")}</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
    ${S.err ? `<div class="err">${esc(S.err)}</div>` : ""}
    <button class="btn" type="submit">${t("signIn")}</button>
    <button type="button" class="link" data-act="lang" data-v="${getLang() === "en" ? "zh" : "en"}">${getLang() === "en" ? "中文" : "English"}</button>
  </form>`;
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
  if (!S.user) { app.innerHTML = loginView(); return; }
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
      <button class="btn danger" data-act="del" data-id="${esc(l.id)}">${t("del")}</button>
      <button class="link" data-act="close">${t("cancel")}</button>
    </div>`;
}

function openSheet(type) {
  $("#sheet-root").innerHTML = sheetHTML(type);
  const el = $("#sheet-form input[name=ml], #sheet-form input[name=c], #sheet-form input[name=kg]");
  if (el && !el.value) setTimeout(() => el.focus(), 120);
}

function doSave(f) {
  if (!f.reportValidity()) return;
  unlockAudio();
  const type = f.dataset.type, fd = new FormData(f);
  const ts = new Date(fd.get("when")).getTime();
  if (!Number.isFinite(ts)) return;
  const log = { type, ts, by: S.user.email };
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

async function doLogin(f) {
  const fd = new FormData(f);
  S.loginEmail = String(fd.get("email") || "").trim();
  if (document.activeElement) document.activeElement.blur();
  S.err = "";
  try {
    await store.signIn(S.loginEmail, String(fd.get("password") || ""));
  } catch (e) {
    console.error(e);
    S.err = t("signInErr");
    render(true);
  }
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
    case "timer-start": unlockAudio(); startTimer(); break;
    case "timer-skip": skipRelax(); break;
    case "timer-clear": store.clearTimer(); break;
    case "lang": setLang(v); render(true); break;
    case "sound":
      S.sound = v === "on"; localStorage.setItem("bt_sound", v);
      if (S.sound) { unlockAudio(); chime(CHIME.burp); }
      render(true); break;
    case "test-sound": unlockAudio(); chime(CHIME.burp); if (navigator.vibrate) navigator.vibrate(200); break;
    case "signout": store.logOut(); break;
    case "del":
      if (confirm(t("confirmDelete"))) { store.deleteLog(el.dataset.id); closeSheet(); toast(t("deleted")); }
      break;
  }
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "login-form") doLogin(e.target);
  else if (e.target.id === "sheet-form") doSave(e.target);
});

document.addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.set;
  if (!k) return;
  let v = e.target.value;
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

async function init() {
  try {
    store = await import("./store.js");
  } catch (e) {
    console.error(e);
    $("#app").innerHTML = `<div class="login"><h1>${t("appName")}</h1><p class="err">Couldn't load. Check your connection and Firebase config, then reload.</p></div>`;
    return;
  }
  store.onAuth((u) => {
    S.authReady = true; S.user = u;
    unsubs.forEach((f) => f && f()); unsubs = [];
    if (u) startSync(); else { S.logs = []; S.timer = null; S.seen = null; }
    render(true);
  });
  setInterval(tick, 250);
  setInterval(() => { if (S.tab === "home" && S.user) render(); }, 30000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
