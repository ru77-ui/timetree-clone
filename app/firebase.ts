import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

// ★ ご自身のFirebase設定値を直接貼り付けてください
const firebaseConfig = {
  apiKey: "AIzaSy...", // 実際のAPIキー
  authDomain: "xxxx.firebaseapp.com",
  projectId: "xxxx",
  storageBucket: "xxxx.appspot.com",
  messagingSenderId: "xxxx",
  appId: "xxxx",
};

// 初期化（二重初期化の防止）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// 通知の許可を得てトークンを取得・保存する関数
export const requestNotificationPermission = async (userId: string) => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log("このブラウザはWeb Push通知に対応していません。");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const messaging = getMessaging(app);
      
      // ★ Firebase Consoleで取得したVAPID鍵を入れてください
      const token = await getToken(messaging, {
        vapidKey: "YOUR_VAPID_KEY_HERE",
      });

      if (token && userId) {
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