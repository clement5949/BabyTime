// Firebase web app config (public by design; access is protected by login + Firestore rules).
// While apiKey is empty the app runs in DEMO MODE: data is stored only on this device.
export const firebaseConfig = {
  apiKey: "AIzaSyDoKbFqtTJX6Yivq9_MnRB3gzezpiin-pI",
  authDomain: "babytime-de3d7.firebaseapp.com",
  projectId: "babytime-de3d7",
  storageBucket: "babytime-de3d7.firebasestorage.app",
  messagingSenderId: "480408643614",
  appId: "1:480408643614:web:c3a01e3b3ef07ab3ed260f",
};

export const isConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
