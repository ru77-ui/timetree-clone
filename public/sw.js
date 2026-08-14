importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAX46aabdLBA79TNFXV6ZXczWgsjOaWPtU",
  authDomain: "timetree-c2ec1.firebaseapp.com",
  projectId: "timetree-c2ec1",
  storageBucket: "timetree-c2ec1.firebasestorage.app",
  messagingSenderId: "437007032407",
  appId: "1:437007032407:web:3353dd1fd9de3557058312"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});