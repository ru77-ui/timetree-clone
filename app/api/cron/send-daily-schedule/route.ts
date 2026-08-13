import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Firebase Admin SDKの初期化（サーバー用）
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function GET() {
  try {
    const db = getFirestore();
    const messaging = getMessaging();

    // 今日の日付を取得（YYYY-MM-DD形式）
    const todayStr = new Date().toISOString().split("T")[0];

    // 全ユーザーの FCM トークンを取得
    const usersSnapshot = await db.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;

      if (!fcmToken) continue;

      // 今日の該当ユーザーの予定を取得
      const eventsSnapshot = await db
        .collection("events")
        .where("userId", "==", userDoc.id)
        .where("date", "==", todayStr)
        .get();

      if (eventsSnapshot.empty) {
        // 今日の予定がない場合
        await messaging.send({
          token: fcmToken,
          notification: {
            title: "📅 本日の予定",
            body: "本日の予定はありません。良い一日を！",
          },
        });
      } else {
        // 今日の予定がある場合
        const eventTitles = eventsSnapshot.docs
          .map((doc) => doc.data().title)
          .join(" / ");

        await messaging.send({
          token: fcmToken,
          notification: {
            title: `📅 今日の予定 (${eventsSnapshot.size}件)`,
            body: eventTitles,
          },
        });
      }
    }

    return NextResponse.json({ success: true, message: "通知を送信しました" });
  } catch (error) {
    console.error("Cron通知処理エラー:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}