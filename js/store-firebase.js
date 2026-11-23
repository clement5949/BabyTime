import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
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

const logsCol = collection(db, "logs");
const timerRef = doc(db, "state", "timer");
const settingsRef = doc(db, "state", "settings");

const fail = (e) => console.error("[store]", e);

export const mode = "firebase";

export const onAuth = (cb) =>
  onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null));
export const signIn = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logOut = () => signOut(auth);

// Logs are one flat collection. Every entry: { type, ts (ms), by, ...fields }.
export function watchLogs(sinceMs, cb) {
  const q = query(logsCol, where("ts", ">=", sinceMs), orderBy("ts", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
}
// Not awaited on purpose: offline writes only resolve once back online.
export const addLog = (log) => { addDoc(logsCol, { ...log, createdAt: Date.now() }).catch(fail); };
export const deleteLog = (id) => { deleteDoc(doc(db, "logs", id)).catch(fail); };

export const watchTimer = (cb) =>
  onSnapshot(timerRef, (s) => cb(s.exists() ? s.data() : null), fail);
export const setTimer = (t) => { setDoc(timerRef, t).catch(fail); };
export const clearTimer = () => { deleteDoc(timerRef).catch(fail); };

export const watchSettings = (cb) =>
  onSnapshot(settingsRef, (s) => cb(s.exists() ? s.data() : null), fail);
export const saveSettings = (s) => { setDoc(settingsRef, s, { merge: true }).catch(fail); };
