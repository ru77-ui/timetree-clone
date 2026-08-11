import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAX46aabdLBA79TNfXV6ZXczWgsjOaWPtU",
  authDomain: "timetree-c2ec1.firebaseapp.com",
  projectId: "timetree-c2ec1",
  storageBucket: "timetree-c2ec1.firebasestorage.app",
  messagingSenderId: "437007032407",
  appId: "1:437007032407:web:3353dd1fd9de3557058312"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);