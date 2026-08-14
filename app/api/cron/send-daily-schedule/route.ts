import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Firebase Admin SDKの初期化
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

    // 現在時刻と1時間後の時刻を計算
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // YYYY-MM-DD 形式の日付と HH:mm 形式の時刻を作成
    const targetDate = oneHourLater.toISOString().split("T")[0];
    const targetTime = oneHourLater.toTimeString().slice(0, 5); // "14:30" などの形式

    // 1時間後に開始 & まだリマインドしていない予定を取得
    const eventsSnapshot = await db
      .collection("events")
      .where("date", "==", targetDate)
      .where("startTime", "==", targetTime)
      .where("reminded", "==", false)
      .get();

    if (eventsSnapshot.empty) {
      return NextResponse.json({ success: true, message: "対象の予定はありません" });
    }

    // 該当する予定ごとに通知を送信
    for (const doc of eventsSnapshot.docs) {
      const event = doc.data();
      const fcmToken = event.fcmToken;

      if (fcmToken) {
        await messaging.send({
          token: fcmToken,
          notification: {
            title: "⏰ まもなく予定の時間です",
            body: `1時間後 (${event.startTime}) から「${event.title}」があります！`,
          },
        });

        // 二重送信防止のため reminded を true に更新
        await doc.ref.update({ reminded: true });
      }
    }

    return NextResponse.json({ success: true, count: eventsSnapshot.size });
  } catch (error) {
    console.error("1時間前リマインダーエラー:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}