// Paste your Firebase web app config here (Firebase Console > Project settings > Your apps).
// While apiKey is empty the app runs in DEMO MODE: data is stored only on this device.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export const isConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
