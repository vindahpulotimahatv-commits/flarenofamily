// js/admin.js
// -----------------------------------------------------------
// Phase 1: hanya menampilkan data dasar anak (nama, XP, streak,
// saldo, status HP) dari collection "children".
// Fitur tugas, approval, dll baru ditambahkan di Phase 2+.
// -----------------------------------------------------------

import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const statusLabel = {
  aktif: "🟢 HP AKTIF",
  terbatas: "🟡 HP TERBATAS",
  terkunci: "🔴 HP TERKUNCI",
  habis: "⏳ WAKTU HABIS"
};

export async function loadChildren() {
  const grid = document.getElementById("childrenGrid");
  grid.innerHTML = "";

  const snap = await getDocs(collection(db, "children"));

  if (snap.empty) {
    grid.innerHTML = "<p>Belum ada data anak. Tambahkan dokumen di collection 'children' pada Firestore.</p>";
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const card = document.createElement("div");
    card.className = "child-card";
    card.innerHTML = `
      <h3>${data.emoji || "🧒"} ${data.name || docSnap.id}</h3>
      <p>⭐ XP: ${data.xp ?? 0}</p>
      <p>🔥 Streak: ${data.streak ?? 0} hari</p>
      <p>💰 Saldo: Rp${(data.saldo ?? 0).toLocaleString("id-ID")}</p>
      <p>${statusLabel[data.hpStatus] || "🟢 HP AKTIF"}</p>
    `;
    grid.appendChild(card);
  });
}
