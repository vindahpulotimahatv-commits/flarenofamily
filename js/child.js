// js/child.js
// -----------------------------------------------------------
// PHASE 2: Dashboard Anak bergaya GAME.
// Semua bahasa di file ini sengaja "anak-ramah" (tidak ada
// istilah Firestore/collection/dsb yang tampil ke anak).
// -----------------------------------------------------------

import { db } from "./firebase.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  formatRupiah, computeLevel, xpProgressInLevel, hpStatusLabel, hpStatusMessage,
  todayStr, categoryIcon, categoryLabel, formatCountdown, timeStrToDateToday,
  formatTanggal, DEFAULT_ALLOWANCE, isTaskEligibleOnDate
} from "./app.js";
import {
  listenTasksForChild, listenLogsForChild, submitTaskPhoto,
  REWARD_CATALOG, redeemReward, listenRedemptions, ensureSaldoUpToDate,
  computeLiveEvaluation, listenSaldoHistory
} from "./tasks.js";

let childId = null;
let childData = {};
let currentTasks = [];
let currentLogs = [];
let prevLogStatus = {}; // taskId -> status sebelumnya, dipakai deteksi "baru disetujui"
let notified = new Set(); // taskId yang sudah dapat reminder hari ini
let activeModalTask = null;
let pendingPhotoFile = null;

export function startChildDashboard(childId_, userData) {
  childId = childId_;

  document.getElementById("greetName").textContent = userData.name || "Anak";

  // Pastikan saldo uang jajan sudah up to date (tutup buku otomatis untuk
  // hari-hari yang jamnya sudah lewat 22:00 dan belum dihitung).
  ensureSaldoUpToDate(childId).catch((err) => console.error("Gagal update saldo:", err));

  const childRef = doc(db, "children", childId);
  onSnapshot(childRef, (snap) => {
    childData = snap.data() || {};
    renderHeader();
    renderLevelCard();
    renderStreakCard();
    renderHpCard();
    renderBadges();
    renderProfile(userData);
  });

  listenTasksForChild(childId, (tasks) => {
    const date = todayStr();
    // Misi yang baru ditambahkan admin SETELAH jam targetnya lewat hari ini
    // sengaja belum ditampilkan hari ini (biar tidak langsung "TERLAMBAT"
    // padahal belum pernah sempat dikerjakan) — akan muncul normal mulai besok.
    currentTasks = tasks.filter((t) => t.active && isTaskEligibleOnDate(t, date));
    renderAll();
  });

  listenLogsForChild(childId, (logs) => {
    detectNewlyApproved(logs);
    currentLogs = logs;
    renderAll();
  });

  listenRedemptions(childId, (items) => {
    renderHistory(items);
  });

  listenSaldoHistory(childId, (items) => {
    renderSaldoHistoryList(items);
  });

  renderRewards();
  setupTabs();
  setupModal();

  checkReminders();
  setInterval(checkReminders, 30000);
  setInterval(tickCountdowns, 1000);

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function renderAll() {
  renderMissionNow();
  renderMissionList();
  renderAdventureMap();
  renderMissionSummary();
  renderSaldoEvaluation();
}

// ---------- HEADER ----------
function renderHeader() {
  document.getElementById("greetEmoji").textContent = childData.emoji || "🧑‍🚀";
}

// ---------- LEVEL CARD ----------
function renderLevelCard() {
  const xp = childData.xp ?? 0;
  const level = computeLevel(xp);
  const progress = xpProgressInLevel(xp);
  document.getElementById("levelCard").innerHTML = `
    <div class="lc-top">
      <span class="lc-trophy">🏆</span>
      <div>
        <div class="lc-level">LEVEL ${level}</div>
        <div class="lc-name">${childData.name || ""}</div>
      </div>
      <div class="lc-xp">⭐ ${xp} XP</div>
    </div>
    <div class="xp-bar"><div class="xp-bar-fill" style="width:${progress}%"></div></div>
    <div class="lc-caption">${progress} / 100 XP menuju Level ${level + 1}</div>
  `;
}

// ---------- STREAK CARD ----------
function renderStreakCard() {
  const streak = childData.streak ?? 0;
  const el = document.getElementById("streakCard");
  if (streak > 0) {
    el.innerHTML = `
      <span class="streak-fire">🔥</span>
      <div class="streak-num">${streak} HARI</div>
      <div class="streak-caption">Pertahankan!</div>
    `;
  } else {
    el.innerHTML = `
      <span class="streak-fire streak-fire-off">🔥</span>
      <div class="streak-num">0 HARI</div>
      <div class="streak-caption">Mulai streak hari ini!</div>
    `;
  }
}

// ---------- HP CARD ----------
function renderHpCard() {
  const status = childData.hpStatus || "aktif";
  document.getElementById("hpCard").innerHTML = `
    <div class="hp-top"><span>📱 WAKTU HP</span></div>
    <div class="hp-status">${hpStatusLabel(status)}</div>
    <div class="hp-msg">${hpStatusMessage(status)}</div>
  `;
}

// ---------- MISI SEKARANG (tugas terdekat yang belum selesai) ----------
function nextActiveTask() {
  const date = todayStr();
  const candidates = currentTasks
    .map((t) => ({ task: t, log: currentLogs.find((l) => l.taskId === t.id && l.date === date) }))
    .filter((x) => !x.log || x.log.status === "rejected");
  candidates.sort((a, b) => a.task.time.localeCompare(b.task.time));
  return candidates[0] || null;
}

function renderMissionNow() {
  const box = document.getElementById("missionNow");
  if (!box) return;
  const next = nextActiveTask();

  if (!next) {
    box.innerHTML = `
      <div class="mn-empty">
        <div class="mn-empty-icon">🎉</div>
        <div class="mn-empty-title">SEMUA MISI SELESAI!</div>
        <div class="mn-empty-sub">Keren! Kamu sudah menyelesaikan semua misi hari ini.</div>
      </div>
    `;
    return;
  }

  const { task } = next;
  const target = timeStrToDateToday(task.time);
  const ms = target.getTime() - Date.now();

  let stateHtml;
  if (ms > 15 * 60000) {
    stateHtml = `<div class="mn-badge mn-badge-wait">⏳ Mulai dalam</div>
                 <div class="mn-countdown" data-countdown="${task.time}">${formatCountdown(ms)}</div>`;
  } else if (ms > 0) {
    stateHtml = `<div class="mn-badge mn-badge-soon">⚠️ SEBENTAR LAGI!</div>
                 <div class="mn-countdown" data-countdown="${task.time}">${formatCountdown(ms)}</div>`;
  } else if (ms > -15 * 60000) {
    stateHtml = `<div class="mn-badge mn-badge-now">🔥 WAKTUNYA MISI!</div>`;
  } else {
    stateHtml = `<div class="mn-badge mn-badge-late">⚠️ TERLAMBAT</div>`;
  }

  box.innerHTML = `
    <div class="mn-label">⚡ MISI SEKARANG</div>
    <div class="mn-card" data-task="${task.id}">
      <div class="mn-icon">${categoryIcon(task.category)}</div>
      <div class="mn-info">
        <div class="mn-title">${task.title.toUpperCase()}</div>
        <div class="mn-time">${task.time}</div>
        ${stateHtml}
      </div>
      <button class="mn-btn" data-task="${task.id}">MULAI MISI</button>
    </div>
  `;
  box.querySelector(".mn-btn").addEventListener("click", () => openModal(task.id));
  box.querySelector(".mn-card").addEventListener("click", (e) => {
    if (e.target.classList.contains("mn-btn")) return;
    openModal(task.id);
  });
}

// ---------- RINGKASAN MISI (progress) ----------
function renderMissionSummary() {
  const el = document.getElementById("missionSummary");
  if (!el) return;
  const date = todayStr();
  const total = currentTasks.length;
  const done = currentTasks.filter((t) => {
    const log = currentLogs.find((l) => l.taskId === t.id && l.date === date);
    return log && log.status === "approved";
  }).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  el.innerHTML = `
    <div class="ms-title">🎯 MISI HARI INI</div>
    <div class="ms-count">${done} / ${total} MISI SELESAI</div>
    <div class="xp-bar"><div class="xp-bar-fill xp-bar-green" style="width:${pct}%"></div></div>
  `;
}

// ---------- DAFTAR MISI (tab Misi) ----------
function statusPillFor(task, log) {
  if (!log) {
    const ms = timeStrToDateToday(task.time).getTime() - Date.now();
    if (ms > 0) return { label: "🎯 BELUM DIMULAI", cls: "st-wait" };
    if (ms > -15 * 60000) return { label: "⚡ WAKTUNYA!", cls: "st-due" };
    return { label: "⚠️ TERLAMBAT", cls: "st-late" };
  }
  if (log.status === "submitted") return { label: "⏳ MENUNGGU ORANG TUA", cls: "st-pending" };
  if (log.status === "approved") return { label: `✅ MISI SELESAI (+${log.xpReward ?? 0} XP)`, cls: "st-done" };
  if (log.status === "rejected") return { label: "❌ MISI BELUM SELESAI", cls: "st-rejected" };
  return { label: "🎯 BELUM DIMULAI", cls: "st-wait" };
}

function renderMissionList() {
  const list = document.getElementById("missionList");
  if (!list) return;
  const date = todayStr();

  if (currentTasks.length === 0) {
    list.innerHTML = `
      <div class="mn-empty">
        <div class="mn-empty-icon">🎯</div>
        <div class="mn-empty-title">BELUM ADA MISI</div>
        <div class="mn-empty-sub">Belum ada tugas untuk hari ini. Tunggu orang tua menambahkan misi.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = "";
  currentTasks.forEach((task) => {
    const log = currentLogs.find((l) => l.taskId === task.id && l.date === date);
    const pill = statusPillFor(task, log);
    const canAct = !log || log.status === "rejected";

    const card = document.createElement("div");
    card.className = "task-card";
    card.innerHTML = `
      <div class="task-card-head">
        <span class="task-card-icon">${categoryIcon(task.category)}</span>
        <span class="task-card-title">${task.title.toUpperCase()}</span>
      </div>
      <div class="task-card-time">${task.time}</div>
      <div class="task-card-xp">⭐ +${task.xpReward} XP</div>
      <div class="status-pill2 ${pill.cls}">${pill.label}</div>
      ${canAct ? `<button class="task-card-btn">${log ? "COBA LAGI" : "KERJAKAN"}</button>` : ""}
    `;
    card.addEventListener("click", () => openModal(task.id));
    list.appendChild(card);
  });
}

// ---------- PETA PETUALANGAN ----------
function renderAdventureMap() {
  const el = document.getElementById("adventureMap");
  if (!el) return;
  const date = todayStr();

  if (currentTasks.length === 0) {
    el.innerHTML = `<p class="muted-light">Belum ada misi untuk dipetakan hari ini.</p>`;
    return;
  }

  const sorted = [...currentTasks].sort((a, b) => a.time.localeCompare(b.time));
  let foundCurrent = false;

  el.innerHTML = sorted.map((task) => {
    const log = currentLogs.find((l) => l.taskId === task.id && l.date === date);
    let icon;
    if (log && log.status === "approved") {
      icon = "✅";
    } else if (!foundCurrent) {
      icon = "🔵";
      foundCurrent = true;
    } else {
      icon = "🔒";
    }
    return `
      <div class="map-step">
        <span class="map-step-icon">${categoryIcon(task.category)}</span>
        <span class="map-step-title">${task.title}</span>
        <span class="map-step-state">${icon}</span>
      </div>
    `;
  }).join("");
}

// ---------- BADGE (dihitung otomatis dari data yang ada) ----------
function computeBadges() {
  const approved = currentLogs.filter((l) => l.status === "approved");
  const belajarCount = approved.filter((l) => {
    const t = currentTasks.find((tt) => tt.id === l.taskId);
    return t && t.category === "belajar";
  }).length;
  const rumahCount = approved.filter((l) => {
    const t = currentTasks.find((tt) => tt.id === l.taskId);
    return t && t.category === "rumah";
  }).length;
  const onTimeCount = approved.filter((l) => {
    const t = currentTasks.find((tt) => tt.id === l.taskId);
    if (!t || !l.submittedAt?.toDate) return false;
    const submitted = l.submittedAt.toDate();
    const [h, m] = t.time.split(":").map(Number);
    const deadline = new Date(submitted);
    deadline.setHours(h, m, 0, 0);
    return submitted <= deadline;
  }).length;

  return [
    { icon: "🔥", label: "3 Hari Beruntun", achieved: (childData.streak ?? 0) >= 3 },
    { icon: "🔥🔥", label: "7 Hari Beruntun", achieved: (childData.streak ?? 0) >= 7 },
    { icon: "📚", label: "Rajin Belajar", achieved: belajarCount >= 5 },
    { icon: "🧹", label: "Jago Beres-beres", achieved: rumahCount >= 5 },
    { icon: "⏰", label: "Tepat Waktu", achieved: onTimeCount >= 5 },
    { icon: "🏆", label: "Mission Master", achieved: approved.length >= 20 }
  ];
}

function renderBadges() {
  const el = document.getElementById("badgeGrid");
  if (!el) return;
  const badges = computeBadges();
  el.innerHTML = badges.map((b) => `
    <div class="badge-item ${b.achieved ? "" : "badge-locked"}">
      <div class="badge-icon">${b.achieved ? b.icon : "🔒"}</div>
      <div class="badge-label">${b.label}</div>
    </div>
  `).join("");
}

// ---------- REWARD ----------
function renderRewards() {
  const el = document.getElementById("rewardGrid");
  if (!el) return;
  el.innerHTML = REWARD_CATALOG.map((r) => `
    <div class="reward-card">
      <div class="reward-icon">${r.icon}</div>
      <div class="reward-title">${r.title}</div>
      <div class="reward-cost">🪙 ${r.cost}</div>
      <button class="reward-btn" data-reward="${r.id}">TUKAR</button>
    </div>
  `).join("");

  el.querySelectorAll(".reward-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const reward = REWARD_CATALOG.find((r) => r.id === btn.dataset.reward);
      const coin = childData.coin ?? 0;
      if (coin < reward.cost) {
        alert("🔒 Coin belum cukup untuk reward ini.");
        return;
      }
      btn.disabled = true;
      try {
        await redeemReward(childId, reward);
        alert(`🎉 Berhasil menukar ${reward.title}! Sampaikan ke Ayah/Bunda ya.`);
      } catch (err) {
        alert(err.message);
      }
      btn.disabled = false;
    });
  });
}

function renderRewardAvailability() {
  const coin = childData.coin ?? 0;
  document.querySelectorAll(".reward-card").forEach((card, i) => {
    const reward = REWARD_CATALOG[i];
    const btn = card.querySelector(".reward-btn");
    if (!reward || !btn) return;
    if (coin < reward.cost) {
      btn.textContent = "🔒 COIN BELUM CUKUP";
      card.classList.add("reward-locked");
    } else {
      btn.textContent = "TUKAR";
      card.classList.remove("reward-locked");
    }
  });
}

// ---------- PROFIL ----------
function renderProfile(userData) {
  const el = document.getElementById("profileBox");
  if (!el) return;
  const level = computeLevel(childData.xp ?? 0);
  el.innerHTML = `
    <div class="profile-avatar">${childData.emoji || "🧑‍🚀"}</div>
    <div class="profile-name">${childData.name || userData.name || ""}</div>
    <div class="profile-kelas">${childData.kelas || ""}</div>
    <div class="profile-stats">
      <span class="badge">🏆 Level ${level}</span>
      <span class="badge">⭐ ${childData.xp ?? 0} XP</span>
      <span class="badge">🔥 ${childData.streak ?? 0} Hari</span>
      <span class="badge">🪙 ${childData.coin ?? 0}</span>
      <span class="badge">💰 ${formatRupiah(childData.saldo)}</span>
    </div>
  `;
}

function renderHistory(items) {
  const el = document.getElementById("historyList");
  if (!el) return;
  if (items.length === 0) {
    el.innerHTML = `<p class="muted-light">Belum ada riwayat penukaran reward.</p>`;
    return;
  }
  el.innerHTML = items.slice(0, 10).map((r) => `
    <div class="history-row">
      <span>${r.rewardIcon} ${r.rewardTitle}</span>
      <span class="muted-light">-${r.cost} 🪙</span>
    </div>
  `).join("");
}

// ---------- EVALUASI SALDO HARI INI (perkiraan, belum resmi sebelum jam 22:00) ----------
const STATUS_LABEL_EVAL = {
  "selesai": "✅ Selesai tepat waktu",
  "telat": "⏰ Selesai tapi telat",
  "belum-waktunya": "🔒 Belum waktunya",
  "berisiko": "⚠️ Belum ada bukti"
};

function renderSaldoEvaluation() {
  const el = document.getElementById("saldoEvalBox");
  if (!el) return;
  const today = todayStr();
  const allowance = childData.dailyAllowance ?? DEFAULT_ALLOWANCE[childId] ?? 0;
  const { items, totalDeduction, estimatedTomorrow } = computeLiveEvaluation(currentTasks, currentLogs, today, allowance);

  const rows = items.map((it) => `
    <div class="saldo-eval-row">
      <span>${categoryIcon(it.task.category)} ${it.task.title}</span>
      <span class="muted-light">${STATUS_LABEL_EVAL[it.status]}${it.deduction > 0 ? ` (-${formatRupiah(it.deduction)})` : ""}</span>
    </div>
  `).join("");

  el.innerHTML = `
    <p class="muted-light" style="margin-bottom:8px;">${formatTanggal(today)} — hasil hari ini dihitung final jam 22:00 dan jadi jajan BESOK.</p>
    ${rows || `<p class="muted-light">Belum ada misi hari ini.</p>`}
    <div class="saldo-eval-total">
      <span>Perkiraan potongan hari ini</span>
      <b>${formatRupiah(totalDeduction)}</b>
    </div>
    <div class="saldo-eval-total">
      <span>Perkiraan jajan besok</span>
      <b>${formatRupiah(estimatedTomorrow)}</b>
    </div>
  `;
}

function renderSaldoHistoryList(items) {
  const el = document.getElementById("saldoHistoryList");
  if (!el) return;
  if (items.length === 0) {
    el.innerHTML = `<p class="muted-light">Belum ada riwayat.</p>`;
    return;
  }
  el.innerHTML = "";
  items.slice(0, 14).forEach((h) => {
    const row = document.createElement("div");
    row.className = "history-row-wrap";

    const head = document.createElement("button");
    head.type = "button";
    head.className = "history-row history-row-btn";
    head.innerHTML = `
      <span>${formatTanggal(h.date)}</span>
      <span class="muted-light">${h.totalDeduction > 0 ? `-${formatRupiah(h.totalDeduction)}` : "Lengkap ✅"} → jajan ${formatTanggal(h.nextDate)}: ${formatRupiah(h.saldoForNextDay)}</span>
    `;

    const detail = document.createElement("div");
    detail.className = "history-detail";
    detail.style.display = "none";
    const items2 = h.taskReport || [];
    detail.innerHTML = items2.length
      ? items2.map((it) => `
          <div class="saldo-eval-row">
            <span>${it.title || "(misi dihapus)"}</span>
            <span class="muted-light">${STATUS_LABEL_EVAL_HISTORY[it.status] || it.status}${it.deduction > 0 ? ` (-${formatRupiah(it.deduction)})` : ""}</span>
          </div>
        `).join("")
      : `<p class="muted-light">Tidak ada rincian.</p>`;

    head.addEventListener("click", () => {
      detail.style.display = detail.style.display === "none" ? "block" : "none";
    });

    row.appendChild(head);
    row.appendChild(detail);
    el.appendChild(row);
  });
}

const STATUS_LABEL_EVAL_HISTORY = {
  done: "✅ Selesai tepat waktu",
  late: "⏰ Selesai tapi telat",
  missed: "❌ Tidak dikerjakan"
};

// ---------- COUNTDOWN TICK (tiap detik, tanpa reload/re-render berat) ----------
function tickCountdowns() {
  document.querySelectorAll("[data-countdown]").forEach((el) => {
    const time = el.dataset.countdown;
    const ms = timeStrToDateToday(time).getTime() - Date.now();
    if (ms <= 0) {
      renderMissionNow(); // waktu habis -> ganti jadi status "waktunya misi"
      return;
    }
    el.textContent = formatCountdown(ms);
  });
  renderRewardAvailability();
}

// ---------- REMINDER 15 MENIT ----------
function checkReminders() {
  const date = todayStr();
  currentTasks.forEach((task) => {
    const log = currentLogs.find((l) => l.taskId === task.id && l.date === date);
    if (log && log.status !== "rejected") return;
    const ms = timeStrToDateToday(task.time).getTime() - Date.now();
    const mins = Math.floor(ms / 60000);
    if (mins <= 15 && mins >= 0 && !notified.has(task.id)) {
      notified.add(task.id);
      showReminder(task);
    }
  });
}

function showReminder(task) {
  const banner = document.getElementById("reminderBanner");
  if (banner) {
    banner.innerHTML = `
      <span class="rb-icon">⏰</span>
      <div>
        <div class="rb-title">MISI SEBENTAR LAGI!</div>
        <div class="rb-sub">${categoryIcon(task.category)} ${task.title} — siapkan dirimu!</div>
      </div>
    `;
    banner.style.display = "flex";
    setTimeout(() => { banner.style.display = "none"; }, 8000);
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Misi Sebentar Lagi!", { body: `${task.title} — jam ${task.time}` });
  }
}

// ---------- DETEKSI MISI BARU DISETUJUI -> ANIMASI ----------
function detectNewlyApproved(newLogs) {
  newLogs.forEach((log) => {
    const prev = prevLogStatus[log.id];
    if (prev !== "approved" && log.status === "approved") {
      const task = currentTasks.find((t) => t.id === log.taskId);
      celebrate(task ? task.title : "Misi", log.xpReward ?? 0);
    }
    prevLogStatus[log.id] = log.status;
  });
}

function celebrate(title, xp) {
  const el = document.getElementById("celebrateOverlay");
  if (!el) return;
  el.innerHTML = `
    <div class="celebrate-box">
      <div class="celebrate-emoji">🎉</div>
      <div class="celebrate-title">MISI SELESAI!</div>
      <div class="celebrate-sub">${title}</div>
      <div class="celebrate-xp">⭐ +${xp} XP</div>
    </div>
  `;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- TAB / BOTTOM NAV ----------
function setupTabs() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("nav-active"));
      document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("tab-active"));
      btn.classList.add("nav-active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("tab-active");
    });
  });

  document.getElementById("profileOpenBtn")?.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("nav-active"));
    document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("tab-active"));
    document.querySelector('.nav-btn[data-tab="profil"]').classList.add("nav-active");
    document.getElementById("tab-profil").classList.add("tab-active");
  });
}

// ---------- MODAL DETAIL MISI ----------
function setupModal() {
  document.getElementById("modalClose")?.addEventListener("click", closeModal);
  document.getElementById("modalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });

  document.getElementById("modalCameraInput")?.addEventListener("change", (e) => handlePhotoPick(e.target.files[0]));

  document.getElementById("modalSendBtn")?.addEventListener("click", async () => {
    if (!pendingPhotoFile || !activeModalTask) return;
    const btn = document.getElementById("modalSendBtn");
    btn.disabled = true;
    btn.textContent = "Mengirim...";
    try {
      const result = await submitTaskPhoto(activeModalTask, childId, pendingPhotoFile);
      closeModal();
      if (result.saldoDeduction > 0) {
        alert(`Bukti terkirim, tapi telat ${result.lateMinutes} menit dari jadwal.\nIni akan mengurangi jajan BESOK sebesar ${formatRupiah(result.saldoDeduction)} (dihitung final jam 22:00).`);
      }
    } catch (err) {
      alert("Gagal mengirim bukti: " + err.message);
      btn.disabled = false;
      btn.textContent = "KIRIM BUKTI";
    }
  });
}

// Kecilkan foto sebelum dikirim, supaya upload tetap cepat & tidak gagal
// walau sinyal anak lagi lemah (paket data). Foto kamera HP bisa 5-15MB,
// setelah dikecilkan biasanya jadi <500KB tanpa terlihat beda di mata.
async function compressPhoto(file, maxDimension = 1280, quality = 0.7) {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file; // gagal compress, pakai file asli sebagai fallback
    return new File([blob], "bukti.jpg", { type: "image/jpeg" });
  } catch (e) {
    // Browser lama / format aneh: kirim file asli saja daripada gagal total
    return file;
  }
}

async function handlePhotoPick(file) {
  if (!file) return;
  const preview = document.getElementById("modalPreview");
  preview.src = URL.createObjectURL(file); // preview pakai file asli, biar instan
  preview.style.display = "block";
  document.getElementById("modalSendBtn").style.display = "block";
  pendingPhotoFile = await compressPhoto(file);
}

function openModal(taskId) {
  const task = currentTasks.find((t) => t.id === taskId);
  if (!task) return;
  activeModalTask = task;
  pendingPhotoFile = null;

  const date = todayStr();
  const log = currentLogs.find((l) => l.taskId === task.id && l.date === date);
  const pill = statusPillFor(task, log);
  const canUpload = !log || log.status === "rejected";

  document.getElementById("modalIcon").textContent = categoryIcon(task.category);
  document.getElementById("modalTitle").textContent = task.title;
  document.getElementById("modalDesc").textContent = task.description || "Selesaikan misi ini sesuai jadwal.";
  document.getElementById("modalTime").textContent = task.time;
  document.getElementById("modalXp").textContent = `⭐ +${task.xpReward} XP`;
  document.getElementById("modalStatusPill").className = "status-pill2 " + pill.cls;
  document.getElementById("modalStatusPill").textContent = pill.label;

  const uploadArea = document.getElementById("modalUploadArea");
  uploadArea.style.display = canUpload ? "block" : "none";
  document.getElementById("modalPreview").style.display = "none";
  document.getElementById("modalSendBtn").style.display = "none";

  if (log?.status === "rejected" && log.reviewNote) {
    document.getElementById("modalReject").style.display = "block";
    document.getElementById("modalReject").textContent = "❌ Ditolak: " + log.reviewNote;
  } else {
    document.getElementById("modalReject").style.display = "none";
  }

  document.getElementById("modalOverlay").classList.add("show");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("show");
  activeModalTask = null;
  pendingPhotoFile = null;
}
