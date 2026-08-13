import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

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
    if (!supported) {
      console.log("このブラウザはWeb Push通知に対応していません。");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const messaging = getMessaging(app);
      
      // ★ ここにFirebase Consoleで取得したVAPID鍵を入れてください
      const token = await getToken(messaging, {
        vapidKey: "YOUR_VAPID_KEY_HERE",
      });

      if (token && userId) {
        // Firestoreの users コレクションに FCM トークンを保存
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "users", userId), { fcmToken: token }, { merge: true });
        console.log("FCM Token saved successfully:", token);
      }
    } else {
      console.log("通知の権限が拒否されました。");
    }
  } catch (error) {
    console.error("通知トークン取得エラー:", error);
  }
};