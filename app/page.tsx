"use client";

import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "private" | "shared";
  userId: string;
  userEmail: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");

  const [mode, setMode] = useState<"private" | "shared">("private");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState("2026-08-11");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setMessage(`エラー: ${error.message}`);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    try {
      await addDoc(collection(db, "events"), {
        title,
        date: selectedDate,
        type: mode,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
      });
      setTitle("");
    } catch (error) {
      console.error("予定追加エラー:", error);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, "events", id));
    } catch (error) {
      console.error("削除エラー:", error);
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>読み込み中...</div>;

  if (!user) {
    return (
      <div style={{ maxWidth: "400px", margin: "80px auto", padding: "24px", border: "1px solid #e2e8f0", borderRadius: "12px", fontFamily: "sans-serif" }}>
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>{isSignUp ? "新規アカウント登録" : "ログイン"}</h2>
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="メールアドレス" style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="パスワード（6文字以上）" style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          <button type="submit" style={{ padding: "12px", backgroundColor: "#10b981", color: "white", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer" }}>
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

  return (
    <div style={{ maxWidth: "500px", margin: "20px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", padding: "10px 16px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
        <span style={{ fontSize: "13px", color: "#475569" }}>👤 {user.email}</span>
        <button onClick={() => signOut(auth)} style={{ padding: "4px 8px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
          ログアウト
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button 
          onClick={() => setMode("private")} 
          style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", backgroundColor: mode === "private" ? "#10b981" : "#e2e8f0", color: mode === "private" ? "white" : "#475569" }}
        >
          🔒 プライベート
        </button>
        <button 
          onClick={() => setMode("shared")} 
          style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", backgroundColor: mode === "shared" ? "#3b82f6" : "#e2e8f0", color: mode === "shared" ? "white" : "#475569" }}
        >
          👥 共有カレンダー
        </button>
      </div>

      <h2 style={{ textAlign: "center" }}>2026年 8月</h2>

      <form onSubmit={handleAddEvent} style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={(e) => setSelectedDate(e.target.value)} 
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
        />
        <input 
          type="text" 
          placeholder="予定のタイトル" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
        />
        <button type="submit" style={{ padding: "8px 16px", backgroundColor: mode === "private" ? "#10b981" : "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
          追加
        </button>
      </form>

      <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <h3 style={{ marginTop: 0, fontSize: "16px" }}>
          {mode === "private" ? "🔒 プライベートの予定一覧" : "👥 共有の予定一覧"}
        </h3>
        {events.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>予定はまだありません。</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {events.map((evt) => (
              <li key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #e2e8f0" }}>
                <div>
                  <span style={{ fontWeight: "bold", fontSize: "14px", marginRight: "8px" }}>{evt.date}</span>
                  <span style={{ fontSize: "14px" }}>{evt.title}</span>
                  {mode === "shared" && (
                    <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>投稿者: {evt.userEmail}</span>
                  )}
                </div>
                <button onClick={() => handleDeleteEvent(evt.id)} style={{ padding: "2px 6px", backgroundColor: "#cbd5e1", color: "#334155", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}