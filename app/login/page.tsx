"use client";

import { useState, useEffect } from "react";
// @/ を使うことで、ルート直下の firebase.ts を正しく読み込みます
import { auth } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");

  // ログイン状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ログイン・会員登録の処理
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("アカウント登録が完了しました！");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage("ログインに成功しました！");
      }
    } catch (error: any) {
      console.error(error);
      setMessage(`エラー: ${error.message}`);
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>読み込み中...</div>;
  }

  // -------------------------------------------------------------
  // 1. 未ログイン時の表示（ログイン / 新規登録 画面）
  // -------------------------------------------------------------
  if (!user) {
    return (
      <div style={{ maxWidth: "400px", margin: "80px auto", padding: "24px", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", fontFamily: "sans-serif" }}>
        <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#1e293b" }}>
          {isSignUp ? "新規アカウント登録" : "ログイン"}
        </h2>
        
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", marginBottom: "6px" }}>メールアドレス</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="example@example.com"
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", marginBottom: "6px" }}>パスワード</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="6文字以上"
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
            />
          </div>

          <button 
            type="submit" 
            style={{ width: "100%", padding: "12px", backgroundColor: "#10b981", color: "white", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", marginTop: "10px" }}
          >
            {isSignUp ? "登録する" : "ログインする"}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: "16px", fontSize: "14px", color: message.startsWith("エラー") ? "#ef4444" : "#10b981", textAlign: "center" }}>
            {message}
          </p>
        )}

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setMessage(""); }} 
            style={{ background: "none", border: "none", color: "#3b82f6", textDecoration: "underline", cursor: "pointer", fontSize: "14px" }}
          >
            {isSignUp ? "すでにアカウントをお持ちの方はこちら（ログイン）" : "新規登録はこちら"}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. ログイン済み時の表示（カレンダー画面）
  // -------------------------------------------------------------
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", padding: "12px 20px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: "14px", color: "#475569" }}>
          ログイン中: <strong>{user.email}</strong>
        </span>
        <button 
          onClick={handleLogout} 
          style={{ padding: "6px 12px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px" }}
        >
          ログアウト
        </button>
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        <h2>2026年 8月</h2>
        <p style={{ color: "#10b981", fontWeight: "bold" }}>🎉 Firebaseログイン成功！カレンダー画面が表示されています！</p>
      </div>
    </div>
  );
}