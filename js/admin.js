// js/admin.js
// -----------------------------------------------------------
// Phase 2: data anak + kelola tugas per anak + antrian approval
// foto bukti + kontrol status HP.
// -----------------------------------------------------------

import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatRupiah, computeLevel, hpStatusLabel, todayStr, CATEGORY_META } from "./app.js";
import {
  createTask, updateTask, deleteTask, listenTasksForChild,
  listenPendingLogs, approveLog, rejectLog, updateChildHpStatus, updateChildField
} from "./tasks.js";

const HP_OPTIONS = ["aktif", "terbatas", "terkunci", "habis"];
const unsubscribers = [];

export async function loadChildren() {
  const grid = document.getElementById("childrenGrid");
  grid.innerHTML = "";

  // Bersihkan listener lama (kalau loadChildren dipanggil ulang).
  unsubscribers.forEach((fn) => fn());
  unsubscribers.length = 0;

  const snap = await getDocs(collection(db, "children"));

  if (snap.empty) {
    grid.innerHTML = "<p>Belum ada data anak. Tambahkan dokumen di collection 'children' pada Firestore.</p>";
    return;
  }

  snap.forEach((docSnap) => {
    const childId = docSnap.id;
    const data = docSnap.data();
    const level = computeLevel(data.xp ?? 0);

    const card = document.createElement("div");
    card.className = "child-card";
    card.innerHTML = `
      <h3>${data.emoji || "🧒"} ${data.name || childId}</h3>
      <label class="hp-label">Kelas</label>
      <input type="text" class="kelas-input" data-child="${childId}" value="${data.kelas || ""}" placeholder="mis. Kelas 3 SD">
      <p>⭐ XP: ${data.xp ?? 0} &nbsp;•&nbsp; 🏅 Level ${level} &nbsp;•&nbsp; 🪙 Coin: ${data.coin ?? 0}</p>
      <p>🔥 Streak: ${data.streak ?? 0} hari</p>
      <p>💰 Saldo: ${formatRupiah(data.saldo)}</p>

      <label class="hp-label">Status HP</label>
      <select class="hp-select" data-child="${childId}">
        ${HP_OPTIONS.map((o) => `<option value="${o}" ${o === (data.hpStatus || "aktif") ? "selected" : ""}>${hpStatusLabel(o)}</option>`).join("")}
      </select>

      <div class="task-section">
        <div class="task-section-head">
          <b>📋 Tugas Harian</b>
        </div>
        <form class="add-task-form" data-child="${childId}">
          <input type="text" name="title" placeholder="Nama tugas (mis. Sikat gigi)" required>
          <select name="category">
            ${Object.entries(CATEGORY_META).map(([key, m]) => `<option value="${key}">${m.icon} ${m.label}</option>`).join("")}
          </select>
          <div class="task-form-row">
            <input type="time" name="time" required>
            <input type="number" name="xpReward" placeholder="XP" min="0" value="10" required>
            <button type="submit">+ Tambah</button>
          </div>
        </form>
        <div class="task-list" data-child="${childId}">
          <p class="muted">Memuat tugas...</p>
        </div>
      </div>
    `;
    grid.appendChild(card);

    // HP status control
    card.querySelector(".hp-select").addEventListener("change", async (e) => {
      await updateChildHpStatus(childId, e.target.value);
    });

    // Kelas (opsional, hanya untuk ditampilkan di profil anak)
    card.querySelector(".kelas-input").addEventListener("blur", async (e) => {
      await updateChildField(childId, "kelas", e.target.value.trim());
    });

    // Add task form
    card.querySelector(".add-task-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const title = form.title.value;
      const time = form.time.value;
      const xpReward = form.xpReward.value;
      const category = form.category.value;
      if (!title || !time) return;
      await createTask(childId, { title, time, xpReward, category });
      form.reset();
      form.xpReward.value = 10;
    });

    // Live task list for this child
    const listEl = card.querySelector(".task-list");
    const unsub = listenTasksForChild(childId, (tasks) => {
      renderTaskList(listEl, tasks);
    });
    unsubscribers.push(unsub);
  });

  // Approval queue (satu untuk semua anak)
  const queueUnsub = listenPendingLogs((logs) => {
    renderApprovalQueue(logs);
  });
  unsubscribers.push(queueUnsub);
}

function renderTaskList(listEl, tasks) {
  if (tasks.length === 0) {
    listEl.innerHTML = `<p class="muted">Belum ada tugas. Tambahkan lewat form di atas.</p>`;
    return;
  }
  listEl.innerHTML = "";
  tasks.forEach((t) => {
    const row = document.createElement("div");
    row.className = "task-row" + (t.active ? "" : " task-row-inactive");
    row.innerHTML = `
      <span class="task-time">${t.time}</span>
      <span class="task-title">${CATEGORY_META[t.category]?.icon || "🎯"} ${t.title}</span>
      <span class="task-xp">+${t.xpReward} XP</span>
      <button class="task-toggle" title="Aktif/nonaktifkan">${t.active ? "⏸️" : "▶️"}</button>
      <button class="task-delete" title="Hapus">🗑️</button>
    `;
    row.querySelector(".task-toggle").addEventListener("click", () => {
      updateTask(t.id, { active: !t.active });
    });
    row.querySelector(".task-delete").addEventListener("click", () => {
      if (confirm(`Hapus tugas "${t.title}"?`)) deleteTask(t.id);
    });
    listEl.appendChild(row);
  });
}

function renderApprovalQueue(logs) {
  const box = document.getElementById("approvalQueue");
  if (!box) return;

  if (logs.length === 0) {
    box.innerHTML = `<p class="muted">Tidak ada bukti foto yang menunggu persetujuan. 🎉</p>`;
    return;
  }

  box.innerHTML = "";
  logs.forEach((log) => {
    const item = document.createElement("div");
    item.className = "approval-item";
    item.innerHTML = `
      <img src="${log.photoUrl}" alt="bukti tugas" class="approval-photo">
      <div class="approval-info">
        <p><b>${log.childId}</b> — tugas: ${log.taskTitle || log.taskId}</p>
        <p class="muted">Tanggal: ${log.date} &nbsp;•&nbsp; +${log.xpReward ?? 0} XP</p>
        <div class="approval-actions">
          <button class="btn-approve">✅ Setujui</button>
          <button class="btn-reject">❌ Tolak</button>
        </div>
      </div>
    `;
    item.querySelector(".btn-approve").addEventListener("click", async (e) => {
      e.target.disabled = true;
      await approveLog(log);
    });
    item.querySelector(".btn-reject").addEventListener("click", async () => {
      const note = prompt("Alasan ditolak (opsional):") || "";
      await rejectLog(log.id, note);
    });
    box.appendChild(item);
  });
}
