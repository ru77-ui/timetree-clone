import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging"; // インポートを追加

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 初期化（二重初期化の防止）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// 通知（FCM）のトークンを取得する関数
export const requestNotificationPermission = async () => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log("このブラウザは Web Push 通知に対応していません。");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const messaging = getMessaging(app);
      // getTokenを修正
      // Firebase Consoleで取得したVAPID鍵（長い文字列）をここに貼り付けます
      const token = await getToken(messaging, { vapidKey: "FirebaseConsoleでコピーした鍵ペアをここに貼り付けてください" });
      console.log("FCM Token:", token);
      return token;
    } else {
      console.log("通知の権限が拒否されました。");
      return null;
    }
  } catch (error) {
    console.error("通知トークンの取得エラー:", error);
    return null;
  }
};