
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAcJWi7h8P4XfHbFGr5vLrowOLrCooVJxk",
  authDomain: "zpos-32a90.firebaseapp.com",
  projectId: "zpos-32a90",
  storageBucket: "zpos-32a90.firebasestorage.app",
  messagingSenderId: "304432089760",
  appId: "1:304432089760:web:73841c81c6d5641addd7c5"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { app, auth, db, storage, functions };
