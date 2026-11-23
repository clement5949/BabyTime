// The app only talks to this file. It picks the Firebase backend when config.js is
// filled in, otherwise a local-only demo backend. Adding a new feature = new log
// `type` (no database changes needed) or a new doc under the `state` collection.
import { isConfigured } from "./config.js";

const impl = isConfigured()
  ? await import("./store-firebase.js")
  : await import("./store-local.js");

export const mode = impl.mode;
export const onAuth = impl.onAuth;
export const signIn = impl.signIn;
export const logOut = impl.logOut;
export const watchLogs = impl.watchLogs;
export const addLog = impl.addLog;
export const deleteLog = impl.deleteLog;
export const watchTimer = impl.watchTimer;
export const setTimer = impl.setTimer;
export const clearTimer = impl.clearTimer;
export const watchSettings = impl.watchSettings;
export const saveSettings = impl.saveSettings;
