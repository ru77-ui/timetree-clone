"use client";

import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  User
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  updateDoc,
  doc, 
  serverTimestamp 
} from "firebase/firestore";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  type: "private" | "shared";
  userId: string;
  userEmail: string;
  displayName?: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");

  // ユーザー表示名設定
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  const [mode, setMode] = useState<"private" | "shared">("private");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  // カレンダー日付管理
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1));
  const [selectedDay, setSelectedDay] = useState<number>(11);
  const [showModal, setShowModal] = useState(false);

  // 編集モード管理
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // フォーム用 (開始・終了時間・タイトル)
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.displayName) {
        setDisplayNameInput(currentUser.displayName);
      }
      setLoading(false);
    });

    // Web通知の許可リクエスト
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => unsubscribe();
  }, []);

  // 1時間前通知タイマー (自分の予定のみ1分ごとに監視)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      if (!user) return;

      const now = new Date();

      events.forEach((evt) => {
        // ★ 自分が登録した予定（userIdが一致）のみ通知する
        if (evt.userId !== user.uid) return;
        if (!evt.startTime || !evt.date) return;

        // 開始日時の計算
        const [yearStr, monthStr, dayStr] = evt.date.split("-");
        const [hourStr, minStr] = evt.startTime.split(":");
        const eventDate = new Date(
          parseInt(yearStr), 
          parseInt(monthStr) - 1, 
          parseInt(dayStr), 
          parseInt(hourStr), 
          parseInt(minStr)
        );

        // 差分（分）
        const diffMs = eventDate.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        // ちょうど1時間前（60分前）に通知を発火
        if (diffMinutes === 60) {
          new Notification("🔔 予定のリマインダー（1時間前）", {
            body: `まもなく予定「${evt.title}」の時間です（${evt.startTime} 〜）`,
            icon: "/favicon.ico"
          });
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [events, user]);

  useEffect(() => {
    if (!user) return;

    const eventsRef = collection(db, "events");
    let q = query(
      eventsRef, 
      where("type", "==", mode),
      ...(mode === "private" ? [where("userId", "==", user.uid)] : [])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents: CalendarEvent[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CalendarEvent[];
      setEvents(fetchedEvents);
    });

    return () => unsubscribe();
  }, [user, mode]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        if (displayNameInput.trim()) {
          await updateProfile(res.user, { displayName: displayNameInput });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setMessage(`エラー: ${error.message}`);
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!user || !displayNameInput.trim()) return;
    try {
      await updateProfile(user, { displayName: displayNameInput });
      setIsEditingName(false);
      alert("名前を変更しました！");
    } catch (error) {
      console.error("名前変更エラー:", error);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const openAddModal = () => {
    setEditingEventId(null);
    setTitle("");
    setStartTime("10:00");
    setEndTime("12:00");
    setShowModal(true);
  };

  const openEditModal = (evt: CalendarEvent) => {
    setEditingEventId(evt.id);
    setTitle(evt.title);
    setStartTime(evt.startTime || "10:00");
    setEndTime(evt.endTime || "12:00");
    setShowModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    const timeDisplay = `${startTime} 〜 ${endTime}`;
    const authorName = user.displayName || user.email?.split("@")[0] || "匿名";

    try {
      if (editingEventId) {
        await updateDoc(doc(db, "events", editingEventId), {
          title,
          startTime,
          endTime,
          time: timeDisplay,
          displayName: authorName
        });
      } else {
        await addDoc(collection(db, "events"), {
          title,
          date: formattedDate,
          startTime,
          endTime,
          time: timeDisplay,
          type: mode,
          userId: user.uid,
          userEmail: user.email,
          displayName: authorName,
          createdAt: serverTimestamp(),
        });
      }
      setTitle("");
      setShowModal(false);
      setEditingEventId(null);
    } catch (error) {
      console.error("予定保存エラー:", error);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, "events", id));
    } catch (error) {
      console.error("削除エラー:", error);
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>読み込み中...</div>;

  if (!user) {
    return (
      <div style={{ maxWidth: "400px", margin: "80px auto", padding: "24px", border: "1px solid #e2e8f0", borderRadius: "16px", fontFamily: "sans-serif", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>{isSignUp ? "新規アカウント登録" : "ログイン"}</h2>
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isSignUp && (
            <input 
              type="text" 
              value={displayNameInput} 
              onChange={(e) => setDisplayNameInput(e.target.value)} 
              placeholder="お名前（表示名/略称）" 
              style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} 
            />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="メールアドレス" style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="パスワード（6文字以上）" style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
          <button type="submit" style={{ padding: "12px", backgroundColor: "#10b981", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: "pointer" }}>
            {isSignUp ? "登録する" : "ログインする"}
          </button>
        </form>
        {message && <p style={{ marginTop: "12px", color: "#ef4444", fontSize: "14px", textAlign: "center" }}>{message}</p>}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: "none", border: "none", color: "#3b82f6", textDecoration: "underline", cursor: "pointer" }}>
            {isSignUp ? "ログインはこちら" : "新規登録はこちら"}
          </button>
        </div>
      </div>
    );
  }

  const selectedDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
  const selectedDayEvents = events.filter((e) => e.date === selectedDateStr);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* ユーザーヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isEditingName ? (
            <div style={{ display: "flex", gap: "4px" }}>
              <input 
                type="text" 
                value={displayNameInput} 
                onChange={(e) => setDisplayNameInput(e.target.value)} 
                placeholder="表示名を入力" 
                style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
              <button onClick={handleUpdateDisplayName} style={{ padding: "4px 8px", backgroundColor: "#059669", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>保存</button>
              <button onClick={() => setIsEditingName(false)} style={{ padding: "4px 8px", backgroundColor: "#e2e8f0", color: "#64748b", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>取消</button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#334155" }}>
                👤 {user.displayName || "名前未設定"} <span style={{ fontSize: "12px", fontWeight: "normal", color: "#94a3b8" }}>({user.email})</span>
              </span>
              <button onClick={() => setIsEditingName(true)} style={{ padding: "2px 6px", backgroundColor: "#f1f5f9", color: "#3b82f6", border: "none", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}>
                名前変更
              </button>
            </>
          )}
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: "4px 10px", backgroundColor: "#f1f5f9", color: "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
          ログアウト
        </button>
      </div>

      {/* コントロールパネル */}
      <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "20px", border: "1px solid #f1f5f9", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>{year}年 {month + 1}月</h1>
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px 8px" }}>&lt;</button>
              <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px 8px" }}>&gt;</button>
            </div>
          </div>
          <button 
            onClick={openAddModal}
            style={{ padding: "10px 18px", backgroundColor: "#059669", color: "white", border: "none", borderRadius: "20px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}
          >
            ＋ 予定を追加
          </button>
        </div>

        {/* モード切り替え */}
        <div style={{ display: "flex", backgroundColor: "#e2e8f0", padding: "4px", borderRadius: "12px" }}>
          <button 
            onClick={() => setMode("private")} 
            style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", backgroundColor: mode === "private" ? "white" : "transparent", color: mode === "private" ? "#059669" : "#64748b", boxShadow: mode === "private" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
          >
            プライベート
          </button>
          <button 
            onClick={() => setMode("shared")} 
            style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", backgroundColor: mode === "shared" ? "white" : "transparent", color: mode === "shared" ? "#2563eb" : "#64748b", boxShadow: mode === "shared" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
          >
            共有カレンダー
          </button>
        </div>
      </div>

      {/* カレンダー本体 */}
      <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "20px", border: "1px solid #f1f5f9", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", marginBottom: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontWeight: "bold", fontSize: "14px", marginBottom: "12px" }}>
          <span style={{ color: "#ef4444" }}>日</span>
          <span style={{ color: "#64748b" }}>月</span>
          <span style={{ color: "#64748b" }}>火</span>
          <span style={{ color: "#64748b" }}>水</span>
          <span style={{ color: "#64748b" }}>木</span>
          <span style={{ color: "#64748b" }}>金</span>
          <span style={{ color: "#3b82f6" }}>土</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px 0", textAlign: "center" }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const hasEvents = events.some((e) => e.date === dateStr);
            const isSelected = selectedDay === dayNum;

            return (
              <div 
                key={dayNum} 
                onClick={() => setSelectedDay(dayNum)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", padding: "6px 0" }}
              >
                <div style={{ 
                  width: "36px", 
                  height: "36px", 
                  borderRadius: "10px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontWeight: isSelected ? "bold" : "500",
                  backgroundColor: isSelected ? "#059669" : "transparent",
                  color: isSelected ? "white" : "#1e293b"
                }}>
                  {dayNum}
                </div>
                <div style={{ height: "6px", marginTop: "2px" }}>
                  {hasEvents && (
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: isSelected ? "white" : "#059669" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 選択日の予定一覧 */}
      <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#334155" }}>
          📅 {month + 1}月{selectedDay}日の予定
        </h3>
        {selectedDayEvents.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>予定はありません。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {selectedDayEvents.map((evt) => (
              <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "bold", padding: "2px 6px", backgroundColor: "#ecfdf5", color: "#059669", borderRadius: "4px" }}>
                      ⏰ {evt.time || (evt.startTime && evt.endTime ? `${evt.startTime} 〜 ${evt.endTime}` : "終日")}
                    </span>
                    <span style={{ fontWeight: "bold", fontSize: "15px" }}>{evt.title}</span>
                  </div>
                  {mode === "shared" && (
                    <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                      投稿: {evt.displayName || evt.userEmail}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => openEditModal(evt)} style={{ padding: "4px 8px", backgroundColor: "#f1f5f9", color: "#2563eb", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>
                    編集
                  </button>
                  <button onClick={() => handleDeleteEvent(evt.id)} style={{ padding: "4px 8px", backgroundColor: "#f1f5f9", color: "#ef4444", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 予定追加・編集モーダル */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "20px", width: "90%", maxWidth: "400px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
              {editingEventId ? "予定を編集" : `${month + 1}月${selectedDay}日に予定を追加`}
            </h3>
            <form onSubmit={handleSaveEvent} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>時間（開始 〜 終了）</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                  <span style={{ color: "#64748b", fontWeight: "bold" }}>〜</span>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>タイトル</label>
                <input 
                  type="text" 
                  placeholder="予定のタイトルを入力" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "10px", border: "none", backgroundColor: "#f1f5f9", color: "#64748b", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                  キャンセル
                </button>
                <button type="submit" style={{ flex: 1, padding: "10px", border: "none", backgroundColor: "#059669", color: "white", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                  {editingEventId ? "更新する" : "追加する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}