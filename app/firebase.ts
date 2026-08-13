import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

// Firebaseの設定情報（元々書いてあったご自身のプロジェクトの設定）
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

// 通知の許可を得てトークンを取得・保存する関数
export const requestNotificationPermission = async (userId: string) => {
  try {
    // ブラウザが通知に対応しているか確認
    const supported = await isSupported();
    if (!supported) return;

    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      const token = await getToken(messaging, {
        // ★ Firebase ConsoleでコピーしたVAPID鍵をここに貼り付けます
        vapidKey: "YOUR_VAPID_KEY_HERE",
      });

      if (token && userId) {
        // ユーザーのFirestoreに通知用トークンを保存
        await updateDoc(doc(db, "users", userId), { fcmToken: token });
        console.log("FCM Token saved:", token);
      }
    }
  } catch (error) {
    console.error("Notification permission error:", error);
  }
};