"use client";

import { useState, useEffect } from "react";
// ★ firebase.ts から requestNotificationPermission を読み込み
import { auth, db, requestNotificationPermission } from "./firebase";
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
  doc, orderBy,
  serverTimestamp,
} from "firebase/firestore";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  isPending?: boolean;
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
  
  // 初期値として「今日」の日付を自動取得してセット
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [showModal, setShowModal] = useState(false);

  // 編集モード管理
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // フォーム用 (時間指定タイプ・開始・終了時間・タイトル)
  const [timeType, setTimeType] = useState<"normal" | "allDay" | "pending">("normal");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
　const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRange, setIsRange] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.displayName) {
        setDisplayNameInput(currentUser.displayName);
      }
      // ★ ユーザーがログインしている場合、プッシュ通知の許可要求＆トークン保存を実行
     if (currentUser) {
  requestNotificationPermission();
}
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Service Worker の登録 & Web通知の許可確認
  useEffect(() => {
    if ("serviceWorker" in navigator && "Notification" in window) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("Service Worker registered:", reg);
      }).catch((err) => {
        console.error("Service Worker registration failed:", err);
      });

      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

 useEffect(() => {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents: CalendarEvent[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CalendarEvent[];
      setEvents(fetchedEvents);
    });

    return () => unsubscribe();
  }, []);
   
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

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now.getDate());
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const openAddModal = () => {
    setEditingEventId(null);
    setTimeType("normal");
    setTitle("");
    setStartTime("10:00");
    setEndTime("12:00");
    setShowModal(true);
  };

  const openEditModal = (evt: CalendarEvent) => {
    setEditingEventId(evt.id);
    setTitle(evt.title);
    if (evt.isAllDay) {
      setTimeType("allDay");
    } else if (evt.isPending) {
      setTimeType("pending");
    } else {
      setTimeType("normal");
      setStartTime(evt.startTime || "10:00");
      setEndTime(evt.endTime || "12:00");
    }
    setShowModal(true);
  };

const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    // 時間表示の整形
    let timeDisplay = "";
    if (timeType === "allDay") timeDisplay = "終日";
    else if (timeType === "pending") timeDisplay = "時間未定";
    else timeDisplay = `${startTime}～${endTime}`;

    const eventData = {
      title,
      startTime: timeType === "normal" ? startTime : null,
      endTime: timeType === "normal" ? endTime : null,
      time: timeDisplay,
      isAllDay: timeType === "allDay",
      isPending: timeType === "pending",
      type: mode,
      displayName: user.displayName || user.email?.split("@")[0] || "ゲスト",
      createdAt: serverTimestamp(),
    };

    try {
      if (editingEventId) {
        // 編集時
        await updateDoc(doc(db, "events", editingEventId), eventData);
      } else {
        // 新規作成時
        if (isRange && startDate && endDate) {
          // ★ 期間指定の場合：開始日から終了日まで1日ずつループして保存
          let current = new Date(startDate);
          const last = new Date(endDate);

          while (current <= last) {
            const formatted = current.toISOString().split("T")[0];
            await addDoc(collection(db, "events"), {
              ...eventData,
              date: formatted,
            });
            current.setDate(current.getDate() + 1);
          }
        } else {
          // 通常（単日）の場合
          const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
          await addDoc(collection(db, "events"), {
            ...eventData,
            date: formattedDate,
          });
        }
      }

      setShowModal(false);
      setTitle("");
      setEditingEventId(null);
      setIsRange(false); // リセット
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

  const realToday = new Date();
  const isTodayInView = realToday.getFullYear() === year && realToday.getMonth() === month;
  const todayNum = realToday.getDate();

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
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", lineHeight: "1" }}>
              {year}年
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "bold", lineHeight: "1.2" }}>
                {month + 1}月
              </h1>
              <div style={{ display: "flex", gap: "2px" }}>
                <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "2px 6px", color: "#475569" }}>&lt;</button>
                <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "2px 6px", color: "#475569" }}>&gt;</button>
              </div>
              <button 
                onClick={goToToday}
                style={{ padding: "3px 8px", backgroundColor: "#e2e8f0", color: "#334155", border: "none", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", marginLeft: "4px" }}
              >
                今日
              </button>
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
            const isRealToday = isTodayInView && dayNum === todayNum;

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
                  fontWeight: isSelected || isRealToday ? "bold" : "500",
                  backgroundColor: isSelected ? "#059669" : "transparent",
                  color: isSelected ? "white" : isRealToday ? "#059669" : "#1e293b",
                  border: isRealToday && !isSelected ? "2px solid #059669" : "none"
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
          {isTodayInView && selectedDay === todayNum && (
            <span style={{ marginLeft: "8px", fontSize: "12px", color: "#059669", backgroundColor: "#ecfdf5", padding: "2px 8px", borderRadius: "12px" }}>今日</span>
          )}
        </h3>
        {selectedDayEvents.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>予定はありません。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {selectedDayEvents.map((evt) => (
              <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ 
                      fontSize: "12px", 
                      fontWeight: "bold", 
                      padding: "2px 6px", 
                      backgroundColor: evt.isAllDay ? "#fef3c7" : evt.isPending ? "#f3e8ff" : "#ecfdf5", 
                      color: evt.isAllDay ? "#d97706" : evt.isPending ? "#7e22ce" : "#059669", 
                      borderRadius: "4px" 
                    }}>
                      ⏰ {evt.time || (evt.startTime && evt.endTime ? `${evt.startTime} 〜 ${evt.endTime}` : "時間指定なし")}
                    </span>
                    <span style={{ fontWeight: "bold", fontSize: "15px" }}>{evt.title}</span>
                  </div>
                    <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                      投稿: {evt.displayName || evt.userEmail}
                    </span>
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
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "6px" }}>時間の指定方法</label>
                <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
                  <button 
                    type="button" 
                    onClick={() => setTimeType("normal")} 
                    style={{ flex: 1, padding: "6px", fontSize: "12px", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", backgroundColor: timeType === "normal" ? "white" : "transparent", color: timeType === "normal" ? "#059669" : "#64748b" }}
                  >
                    時間指定
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setTimeType("allDay")} 
                    style={{ flex: 1, padding: "6px", fontSize: "12px", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", backgroundColor: timeType === "allDay" ? "white" : "transparent", color: timeType === "allDay" ? "#d97706" : "#64748b" }}
                  >
                    終日
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setTimeType("pending")} 
                    style={{ flex: 1, padding: "6px", fontSize: "12px", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", backgroundColor: timeType === "pending" ? "white" : "transparent", color: timeType === "pending" ? "#7e22ce" : "#64748b" }}
                  >
                    未定
                  </button>
                </div>
              </div>

              {timeType === "normal" && (
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
              )}

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
{/* ★ ここ（543行目）に貼り付け！ */}
             <div style={{ marginBottom: "12px", borderTop: "1px solid #eee", paddingTop: "8px" }}>
               <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>
                 <input
                   type="checkbox"
                   checked={isRange}
                   onChange={(e) => setIsRange(e.target.checked)}
                 />
                 複数日にわたる予定にする（期間指定）
               </label>

               {isRange && (
                 <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                   <input
                     type="date"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                   />
                   <span>〜</span>
                   <input
                     type="date"
                     value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                     style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                   />
                 </div>
               )}
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