// js/admin.js
// -----------------------------------------------------------
// Phase 2: data anak + kelola tugas per anak + antrian approval
// foto bukti + kontrol status HP.
// -----------------------------------------------------------

import { db } from "./firebase.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatRupiah, computeLevel, hpStatusLabel, todayStr, formatTanggal, CATEGORY_META, DEFAULT_ALLOWANCE } from "./app.js";
import {
  createTask, updateTask, deleteTask, listenTasksForChild,
  listenPendingLogs, approveLog, rejectLog, updateChildHpStatus, updateChildField,
  ensureSaldoUpToDate, listenSaldoHistory,
  addManualDeduction, deleteManualDeduction, listenManualDeductions
} from "./tasks.js";

const REPORT_STATUS_LABEL = {
  done: "✅ Selesai tepat waktu",
  late: "⏰ Selesai tapi telat",
  missed: "❌ Tidak dikerjakan"
};

const HP_OPTIONS = ["aktif", "terbatas", "terkunci", "habis"];
const unsubscribers = [];

export async function loadChildren() {
  const grid = document.getElementById("childrenGrid");
  grid.innerHTML = "";

  // Bersihkan listener lama (kalau loadChildren dipanggil ulang).
  unsubscribers.forEach((fn) => fn());
  unsubscribers.length = 0;

  // Approval queue (satu untuk semua anak) — dipasang duluan supaya tetap
  // jalan meski koleksi 'children' kosong atau gagal dimuat.
  const queueUnsub = listenPendingLogs((logs) => {
    renderApprovalQueue(logs);
  });
  unsubscribers.push(queueUnsub);

  let snap;
  try {
    snap = await getDocs(collection(db, "children"));
  } catch (err) {
    grid.innerHTML = `<p style="color:#dc2626;font-weight:700;">⚠️ Gagal memuat data anak: ${err.message}</p>`;
    return;
  }

  if (snap.empty) {
    grid.innerHTML = "<p>Belum ada data anak. Tambahkan dokumen di collection 'children' pada Firestore.</p>";
    return;
  }

  for (const docSnap of snap.docs) {
    const childId = docSnap.id;
    let card;
    try {

    // Pastikan saldo sudah up to date (tutup buku otomatis untuk hari-hari
    // yang jamnya sudah lewat 22:00 dan belum dihitung).
    await ensureSaldoUpToDate(childId);
    const freshSnap = await getDoc(doc(db, "children", childId));
    const data = freshSnap.data() || {};
    const level = computeLevel(data.xp ?? 0);
    const allowance = data.dailyAllowance ?? DEFAULT_ALLOWANCE[childId] ?? 0;

    card = document.createElement("div");
    card.className = "child-card";
    card.innerHTML = `
      <h3>${data.emoji || "🧒"} ${data.name || childId}</h3>
      <label class="hp-label">Kelas</label>
      <input type="text" class="kelas-input" data-child="${childId}" value="${data.kelas || ""}" placeholder="mis. Kelas 3 SD">
      <p>⭐ XP: ${data.xp ?? 0} &nbsp;•&nbsp; 🏅 Level ${level} &nbsp;•&nbsp; 🪙 Coin: ${data.coin ?? 0}</p>
      <p>🔥 Streak: ${data.streak ?? 0} hari</p>
      <p>💰 Saldo hari ini: <b>${formatRupiah(data.saldo)}</b></p>

      <label class="hp-label">Jatah Uang Jajan Harian (Rp)</label>
      <input type="number" class="allowance-input" data-child="${childId}" value="${allowance}" min="0" step="500">
      <p class="muted" style="font-size:12px;margin-top:2px;">Jam 22:00 tiap hari "tutup buku": jajan BESOK = jatah penuh dikurangi total potongan manual hari itu. Tidak ada potongan otomatis — kamu isi sendiri di bawah. Misi telat &gt; 1 jam otomatis dianggap tidak dikerjakan.</p>

      <div class="task-section">
        <div class="task-section-head"><b>✂️ Potongan Saldo (manual)</b></div>
        <form class="deduct-form" data-child="${childId}">
          <div class="task-form-row">
            <input type="number" name="amount" placeholder="Nominal (Rp)" min="500" step="500" required>
            <input type="date" name="date" value="${todayStr()}" required>
          </div>
          <div class="task-form-row">
            <input type="text" name="reason" placeholder="Alasan (mis. telat sikat gigi)">
            <button type="submit">+ Potong</button>
          </div>
        </form>
        <div class="deduct-list" data-child="${childId}"><p class="muted">Memuat potongan...</p></div>
      </div>

      <label class="hp-label">Status HP</label>
      <select class="hp-select" data-child="${childId}">
        ${HP_OPTIONS.map((o) => `<option value="${o}" ${o === (data.hpStatus || "aktif") ? "selected" : ""}>${hpStatusLabel(o)}</option>`).join("")}
      </select>

      <div class="task-section">
        <div class="task-section-head">
          <b>📋 Tugas Harian</b>
        </div>
        <p class="muted" style="font-size:12px;margin-top:-4px;margin-bottom:6px;">🔁 Setiap misi yang ditambahkan di sini otomatis berulang SETIAP HARI — tidak perlu diisi ulang tiap hari. Tekan ⏸️ untuk menonaktifkan sementara atau 🗑️ untuk menghapus permanen.</p>
        <form class="add-task-form" data-child="${childId}">
          <input type="text" name="title" placeholder="Nama tugas (mis. Sikat gigi)" required>
          <select name="category">
            ${Object.entries(CATEGORY_META).map(([key, m]) => `<option value="${key}">${m.icon} ${m.label}</option>`).join("")}
          </select>
          <div class="task-form-row">
            <input type="time" name="time" required>
            <input type="number" name="xpReward" placeholder="XP" min="0" value="10" required>
          </div>
          <div class="task-form-row">
            <label class="hp-label" style="margin:0;align-self:center;">Mulai tanggal (opsional)</label>
            <input type="date" name="startDate" min="${todayStr()}">
            <button type="submit">+ Tambah</button>
          </div>
        </form>
        <p class="muted" style="font-size:11px;margin-top:2px;">Kosongkan "Mulai tanggal" kalau mau misi langsung berlaku hari ini/besok secara otomatis. Isi kalau mau tentukan sendiri kapan misi ini mulai berlaku (mis. mulai Senin depan).</p>
        <div class="task-list" data-child="${childId}">
          <p class="muted">Memuat tugas...</p>
        </div>
      </div>

      <div class="task-section">
        <div class="task-section-head">
          <b>📊 Laporan Harian</b>
        </div>
        <div class="report-list" data-child="${childId}">
          <p class="muted">Memuat laporan...</p>
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

    // Jatah uang jajan harian (dipakai mulai hari berikutnya saat saldo direset)
    card.querySelector(".allowance-input").addEventListener("blur", async (e) => {
      const val = Number(e.target.value) || 0;
      await updateChildField(childId, "dailyAllowance", val);
    });

    // Potongan manual
    card.querySelector(".deduct-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await addManualDeduction(childId, f.date.value, f.amount.value, f.reason.value);
        f.amount.value = "";
        f.reason.value = "";
      } catch (err) {
        alert(err.message);
      }
    });
    const deductEl = card.querySelector(".deduct-list");
    unsubscribers.push(listenManualDeductions(childId, (items) => renderDeductions(deductEl, items)));

    // Add task form
    card.querySelector(".add-task-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const title = form.title.value;
      const time = form.time.value;
      const xpReward = form.xpReward.value;
      const category = form.category.value;
      const startDate = form.startDate.value;
      if (!title || !time) return;
      await createTask(childId, { title, time, xpReward, category, startDate });
      form.reset();
      form.xpReward.value = 10;
    });

    // Live task list for this child
    const listEl = card.querySelector(".task-list");
    const unsub = listenTasksForChild(childId, (tasks) => {
      renderTaskList(listEl, tasks);
    });
    unsubscribers.push(unsub);

    // Live laporan harian (histori tutup buku) untuk evaluasi orang tua
    const reportEl = card.querySelector(".report-list");
    const reportUnsub = listenSaldoHistory(childId, (history) => {
      renderDailyReport(reportEl, history);
    });
    unsubscribers.push(reportUnsub);

    } catch (err) {
      const errCard = document.createElement("div");
      errCard.className = "child-card";
      errCard.innerHTML = `<p style="color:#dc2626;font-weight:700;">⚠️ Gagal memuat data untuk "${childId}": ${err.message}</p>`;
      grid.appendChild(errCard);
      console.error(`loadChildren: error processing child ${childId}`, err);
    }
  }
}

function renderDeductions(el, items) {
  if (items.length === 0) {
    el.innerHTML = `<p class="muted" style="font-size:12px;">Belum ada potongan.</p>`;
    return;
  }
  el.innerHTML = "";
  items.slice(0, 15).forEach((d) => {
    const row = document.createElement("div");
    row.className = "task-row";
    row.innerHTML = `
      <span class="task-time">${formatTanggal(d.date)}</span>
      <span class="task-title">${d.reason || "(tanpa alasan)"}</span>
      <span class="task-xp">-${formatRupiah(d.amount)}</span>
      <button class="task-delete" title="Hapus">🗑️</button>
    `;
    row.querySelector(".task-delete").addEventListener("click", () => {
      if (confirm("Hapus potongan ini?")) deleteManualDeduction(d.id);
    });
    el.appendChild(row);
  });
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
    const startsFuture = t.firstEligibleDate && t.firstEligibleDate > todayStr();
    row.innerHTML = `
      <span class="task-time">${t.time}</span>
      <span class="task-title">${CATEGORY_META[t.category]?.icon || "🎯"} ${t.title}</span>
      ${startsFuture ? `<span class="muted" style="font-size:11px;">📅 mulai ${formatTanggal(t.firstEligibleDate)}</span>` : ""}
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

// Laporan harian: tiap baris = 1 hari yang sudah "tutup buku" (saldoHistory),
// bisa diklik untuk buka rincian tugas apa saja yang dikerjakan/tidak hari itu.
function renderDailyReport(el, history) {
  if (!el) return;
  if (history.length === 0) {
    el.innerHTML = `<p class="muted">Belum ada laporan. Laporan muncul setelah hari pertama "tutup buku" jam 22:00.</p>`;
    return;
  }

  el.innerHTML = "";
  history.slice(0, 30).forEach((h) => {
    const row = document.createElement("div");
    row.className = "report-day";

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "report-day-head";
    summary.innerHTML = `
      <span>${formatTanggal(h.date)}</span>
      <span class="muted" style="font-size:12px;">
        ✅${h.doneTasks ?? 0} &nbsp;⏰${h.lateTasks ?? 0} &nbsp;❌${h.missedTasks ?? 0}
        &nbsp;•&nbsp; ${h.totalDeduction > 0 ? `-${formatRupiah(h.totalDeduction)}` : "Lengkap"}
      </span>
    `;

    const detail = document.createElement("div");
    detail.className = "report-day-detail";
    detail.style.display = "none";
    const items = h.taskReport || [];
    detail.innerHTML = items.length
      ? items.map((it) => `
          <div class="report-task-row">
            <span>${it.title || "(tugas dihapus)"}</span>
            <span class="muted-light">${REPORT_STATUS_LABEL[it.status] || it.status}${it.deduction > 0 ? ` (-${formatRupiah(it.deduction)})` : ""}</span>
          </div>
        `).join("")
      : `<p class="muted" style="font-size:12px;">Tidak ada rincian tugas untuk hari ini.</p>`;
    (h.manualDeductions || []).forEach((d) => {
      detail.innerHTML += `<div class="report-task-row"><span>✂️ ${d.reason || "Potongan manual"}</span><span class="muted-light">-${formatRupiah(d.amount)}</span></div>`;
    });
    detail.innerHTML += `<p class="muted" style="font-size:12px;margin-top:6px;">Jajan tanggal ${formatTanggal(h.nextDate)}: <b>${formatRupiah(h.saldoForNextDay)}</b></p>`;

    summary.addEventListener("click", () => {
      detail.style.display = detail.style.display === "none" ? "block" : "none";
    });

    row.appendChild(summary);
    row.appendChild(detail);
    el.appendChild(row);
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
      <img src="${log.photoUrl}" alt="bukti tugas" class="approval-photo" loading="lazy"
           onerror="this.outerHTML='&lt;a href=&quot;${log.photoUrl}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot; class=&quot;approval-photo-broken&quot;&gt;⚠️ Foto gagal dimuat<br><small>🔗 Tap untuk buka link foto langsung</small>&lt;/a&gt;'">
      <div class="approval-info">
        <p><b>${log.childId}</b> — tugas: ${log.taskTitle || log.taskId}</p>
        <p class="muted">Tanggal: ${log.date} &nbsp;•&nbsp; +${log.xpReward ?? 0} XP</p>
        ${log.lateMinutes > 0
          ? `<p class="muted">⏰ Telat ${log.lateMinutes} menit — isi potongan manual di kartu anak kalau perlu.</p>`
          : ""}
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
