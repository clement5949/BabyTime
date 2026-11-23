import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, deleteDoc, setDoc, onSnapshot, query, where, orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Offline cache: entries made without signal are saved on the phone and synced later.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const fail = (e) => console.error("[store]", e);

export const mode = "firebase";
export const needsFamily = true;

// All data lives under families/<secret code>/... The code is the long random part of
// the private link, so only people who have the link can find the data.
let fam = null;
export const setFamily = (id) => { fam = id; };
const logsCol = () => collection(db, "families", fam, "logs");
const stateDoc = (name) => doc(db, "families", fam, "state", name);

// No accounts: each phone signs in anonymously. The private link is the real key.
export function onAuth(cb, onError) {
  let signing = false;
  return onAuthStateChanged(auth, (u) => {
    if (u) { cb({ id: u.uid }); return; }
    if (signing) return;
    signing = true;
    signInAnonymously(auth).catch((e) => { signing = false; (onError || fail)(e); });
  });
}

// Logs are one flat collection. Every entry: { type, ts (ms), by, ...fields }.
export function watchLogs(sinceMs, cb) {
  const q = query(logsCol(), where("ts", ">=", sinceMs), orderBy("ts", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
}
// Not awaited on purpose: offline writes only resolve once back online.
export const addLog = (log) => {
  const ref = doc(logsCol()); // id is generated on the phone, so it can be undone instantly
  setDoc(ref, { ...log, createdAt: Date.now() }).catch(fail);
  return ref.id;
};
export const updateLog = (id, patch) => { setDoc(doc(db, "families", fam, "logs", id), patch, { merge: true }).catch(fail); };
export const deleteLog = (id) => { deleteDoc(doc(db, "families", fam, "logs", id)).catch(fail); };

export const watchTimer = (cb) =>
  onSnapshot(stateDoc("timer"), (s) => cb(s.exists() ? s.data() : null), fail);
export const setTimer = (t) => { setDoc(stateDoc("timer"), t).catch(fail); };
export const clearTimer = () => { deleteDoc(stateDoc("timer")).catch(fail); };

export const watchSettings = (cb) =>
  onSnapshot(stateDoc("settings"), (s) => cb(s.exists() ? s.data() : null), fail);
export const saveSettings = (s) => { setDoc(stateDoc("settings"), s, { merge: true }).catch(fail); };
