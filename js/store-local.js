// DEMO backend: everything lives in this browser's localStorage. Same API as the
// Firebase store, so the UI doesn't care which one it is using.
export const mode = "local";

const KEY = "bt_demo";
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const state = { logs: [], timer: null, settings: null, ...load() };
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

const subs = { logs: new Set(), timer: new Set(), settings: new Set() };
const emit = (k) => subs[k].forEach((f) => f());

function watch(k, push) {
  const f = () => push();
  subs[k].add(f);
  queueMicrotask(f);
  return () => subs[k].delete(f);
}

const user = { id: "demo" };
// Add ?family to the address to try the private-link screens in demo mode.
export const needsFamily = new URLSearchParams(location.search).has("family");
export const setFamily = () => {};
export const onAuth = (cb) => { queueMicrotask(() => cb(user)); return () => {}; };

const sorted = () => [...state.logs].sort((a, b) => b.ts - a.ts);

export const watchLogs = (since, cb) =>
  watch("logs", () => cb(sorted().filter((l) => l.ts >= since)));
export const addLog = (log) => {
  state.logs.push({ ...log, id: "l" + Date.now() + Math.random().toString(36).slice(2, 6) });
  save(); emit("logs");
};
export const deleteLog = (id) => {
  state.logs = state.logs.filter((l) => l.id !== id);
  save(); emit("logs");
};

export const watchTimer = (cb) => watch("timer", () => cb(state.timer));
export const setTimer = (t) => { state.timer = t; save(); emit("timer"); };
export const clearTimer = () => { state.timer = null; save(); emit("timer"); };

export const watchSettings = (cb) => watch("settings", () => cb(state.settings));
export const saveSettings = (s) => {
  state.settings = { ...(state.settings || {}), ...s };
  save(); emit("settings");
};
