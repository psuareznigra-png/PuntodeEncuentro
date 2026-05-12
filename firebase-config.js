/**
 * Punto Activo "Centro de Entrenamiento"
 * Firebase Configuration
 *
 * ⚠️  REEMPLAZÁ los valores con los de TU proyecto Firebase.
 * Obtenerlos en: Firebase Console → Project Settings → Tu app web
 */

const firebaseConfig = {
  apiKey: "AIzaSyCfrlHWygWBCMRee5jYydF_UiEQLlet_To",
  authDomain: "alina-y-javier.firebaseapp.com",
  projectId: "alina-y-javier",
  storageBucket: "alina-y-javier.firebasestorage.app",
  messagingSenderId: "658705404300",
  appId: "1:658705404300:web:1b879bd19e241e247dc6a9"
};

// ── Inicializar app principal ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);

// ── App secundaria: para que Admin pueda crear cuentas de socios
//    sin cerrar su propia sesión ──────────────────────────────────
const secondaryApp = firebase.initializeApp(firebaseConfig, 'secondary');

// ── Referencias globales ───────────────────────────────────────────
const db = firebase.firestore();
const auth = firebase.auth();
const secondaryAuth = firebase.auth(secondaryApp);
const storage = firebase.storage();

// ── Persistencia de sesión (mantiene sesión entre recargas) ───────
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

window.db = db;
window.auth = auth;
window.secondaryAuth = secondaryAuth;
window.storage = storage;
window.firebase = firebase;
