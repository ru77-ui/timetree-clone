self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// バックグラウンドで通知を表示する処理
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "📅 本日の予定のお知らせ";
  const options = {
    body: data.body || "本日の予定をご確認ください。",
    icon: "/favicon.ico",
    badge: "/favicon.ico"
  };

  event.waitUntil(self.registration.showNotification(title, options));
});