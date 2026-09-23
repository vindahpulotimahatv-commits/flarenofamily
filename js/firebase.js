// js/firebase.js
// -----------------------------------------------------------
// GANTI seluruh nilai di bawah ini dengan Firebase Config
// milikmu sendiri. Kamu bisa mengambilnya di:
// Firebase Console > Project Settings > General > Your apps > Web app
// -----------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjgbtlsgrlkkOoJMw_A6uOLp7gIIHOnbQ",
  authDomain: "misi-harian-keluarga.firebaseapp.com",
  projectId: "misi-harian-keluarga",
  storageBucket: "misi-harian-keluarga.firebasestorage.app",
  messagingSenderId: "911514243633",
  appId: "1:911514243633:web:4f228b15b5d0c92ba5bb10"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
