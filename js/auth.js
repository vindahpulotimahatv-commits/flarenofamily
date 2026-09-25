// js/auth.js
// -----------------------------------------------------------
// Menangani: login, logout, deteksi role (admin/khanaya/asensio),
// dan redirect otomatis sesuai role.
//
// Struktur dokumen di Firestore collection "users":
// users/{uid} = {
//   role: "admin" | "khanaya" | "asensio",
//   childId: "khanaya" | "asensio" | null,
//   name: "Nama"
// }
// -----------------------------------------------------------

import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Jembatan ke aplikasi Android (APK) ----------
// Di browser biasa window.FlarenoNative tidak ada, jadi fungsi ini tidak melakukan apa-apa.
function nativeRegisterChild(user, childId) {
  try {
    if (window.FlarenoNative && user.refreshToken) {
      window.FlarenoNative.registerChild(childId, user.refreshToken, auth.app.options.apiKey);
    }
  } catch (e) {
    console.warn("native bridge:", e);
  }
}

function nativeRegisterAdmin(user) {
  try {
    if (window.FlarenoNative && user.refreshToken) {
      window.FlarenoNative.registerAdmin(user.refreshToken, auth.app.options.apiKey);
    }
  } catch (e) {
    console.warn("native bridge:", e);
  }
}

// Ambil data role user yang sedang login dari Firestore
export async function getUserRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data(); // { role, childId, name }
}

// Login dengan email + password
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userData = await getUserRole(cred.user.uid);

  if (!userData) {
    throw new Error("Akun ini belum terdaftar di data users Firestore.");
  }

  // Redirect sesuai role
  if (userData.role === "admin") {
    window.location.href = "admin.html";
  } else {
    // khanaya / asensio -> untuk versi website ini sementara
    // diarahkan ke child.html (versi lengkap ada di Android App)
    window.location.href = "child.html";
  }
}

// Dipakai di index.html (halaman login): kalau ternyata sudah ada sesi
// login yang tersimpan (Firebase Auth otomatis menyimpan sesi, TIDAK pernah
// logout sendiri hanya karena aplikasi ditutup/di-kill), langsung lempar ke
// dashboard yang sesuai tanpa perlu login ulang. Kalau memang belum ada
// sesi, tampilkan form login seperti biasa.
export function redirectIfLoggedIn(onNoSession) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onNoSession?.();
      return;
    }
    const userData = await getUserRole(user.uid);
    if (!userData) {
      onNoSession?.();
      return;
    }
    window.location.href = userData.role === "admin" ? "admin.html" : "child.html";
  });
}

export function logout() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
}

// Dipakai di admin.html / child.html untuk memastikan
// hanya user dengan role yang sesuai yang boleh membuka halaman.
// requiredRole: "admin" atau "child" (khanaya/asensio dianggap "child")
export function guardPage(requiredRole, onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const userData = await getUserRole(user.uid);
    if (!userData) {
      window.location.href = "index.html";
      return;
    }

    const isAdmin = userData.role === "admin";
    const isChild = userData.role === "khanaya" || userData.role === "asensio";

    if (requiredRole === "admin" && !isAdmin) {
      window.location.href = "index.html";
      return;
    }
    if (requiredRole === "child" && !isChild) {
      window.location.href = "index.html";
      return;
    }

    // Anak login di APK -> aktifkan pemantauan (kunci HP + notifikasi).
    // Orang tua login di APK -> HP itu jadi HP orang tua (notifikasi kalau HP anak terkunci).
    if (isChild) nativeRegisterChild(user, userData.childId);
    if (isAdmin) nativeRegisterAdmin(user);

    onReady(user, userData);
  });
}
