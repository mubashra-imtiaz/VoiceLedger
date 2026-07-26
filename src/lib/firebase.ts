import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDc935DYbkNb8lqOObUFgsjDfcbbLkBjX4",
  authDomain: "voiceledger-5ba38.firebaseapp.com",
  projectId: "voiceledger-5ba38",
  storageBucket: "voiceledger-5ba38.firebasestorage.app",
  messagingSenderId: "1096975464928",
  appId: "1:1096975464928:web:f6df5d66a32ad740e19385",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Offline persistence (browser only)
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) =>
    console.log("Persistence error:", err.code),
  );
}


