importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Los datos de configuración deben coincidir con firebase-config.js
// IMPORTANTE: En un entorno real, estos datos se inyectan dinámicamente o se comparten
// Por ahora, usamos marcadores de posición que el usuario deberá completar o que yo intentaré leer
// de firebase-config.js si es posible.

firebase.initializeApp({
  apiKey: "AIzaSyCfrlHWygWBCMRee5jYydF_UiEQLlet_To",
  authDomain: "alina-y-javier.firebaseapp.com",
  projectId: "alina-y-javier",
  storageBucket: "alina-y-javier.firebasestorage.app",
  messagingSenderId: "658705404300",
  appId: "1:658705404300:web:1b879bd19e241e247dc6a9"
});

const messaging = firebase.messaging();

// Manejador de mensajes en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Recibido mensaje en segundo plano ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'Img/Punto Activo.jpeg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
