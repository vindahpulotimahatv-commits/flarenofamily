// js/tasks.js
// -----------------------------------------------------------
// Phase 2: Sistem Tugas & Jadwal + Upload Bukti + Approval.
//
// Struktur Firestore baru:
//
// tasks/{taskId} = {
//   childId: "khanaya" | "asensio",
//   title: "Sikat gigi pagi",
//   description: "..." (opsional),
//   time: "07:00"  (jam target, format HH:MM, 24 jam),
//   xpReward: 10,
//   active: true,
//   createdAt: Timestamp
// }
//
// logs/{taskId_YYYY-MM-DD} = {
//   taskId, childId, date,
//   status: "submitted" | "approved" | "rejected",
//   photoUrl, note,
//   xpReward,           // disalin dari task saat submit, jadi tidak berubah walau task diedit
//   submittedAt, reviewedAt, reviewNote
// }
//
// Catatan penting: semua query di file ini SENGAJA hanya pakai
// satu filter "where" (equality) lalu sisanya disaring di JavaScript.
// Ini supaya tidak perlu membuat Composite Index manual di Firestore
// Console (fitur itu agak teknis untuk pemula).
// -----------------------------------------------------------

import { db, IMGBB_API_KEY } from "./firebase.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, onSnapshot, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  todayStr, yesterdayStr, computeLevel, timeStrToDateToday,
  DEFAULT_ALLOWANCE, lateDeduction, MISSED_TASK_DEDUCTION,
  SALDO_CLOSING_HOUR, addDaysToDateStr, computeFirstEligibleDate,
  isTaskEligibleOnDate
} from "./app.js";

const tasksCol = collection(db, "tasks");
const logsCol = collection(db, "logs");

export function logIdFor(taskId, date) {
  return `${taskId}_${date}`;
}

// ---------- TASKS ----------

export async function createTask(childId, { title, description, time, xpReward, category }) {
  // Misi ini otomatis berulang SETIAP HARI (tidak perlu dibuat ulang tiap
  // hari) — supaya tidak langsung muncul "TERLAMBAT" kalau ditambahkan
  // setelah jam targetnya lewat hari ini, misi baru mulai "berlaku" besok
  // dalam kasus itu (lihat computeFirstEligibleDate di app.js).
  const firstEligibleDate = computeFirstEligibleDate(time);
  return addDoc(tasksCol, {
    childId,
    title: title.trim(),
    description: (description || "").trim(),
    time,
    category: category || "belajar",
    xpReward: Number(xpReward) || 0,
    active: true,
    firstEligibleDate,
    createdAt: serverTimestamp()
  });
}

export function updateTask(taskId, data) {
  return updateDoc(doc(db, "tasks", taskId), data);
}

export function deleteTask(taskId) {
  return deleteDoc(doc(db, "tasks", taskId));
}

// Live listener semua tugas milik satu anak (termasuk yang non-aktif; filter di UI kalau perlu).
export function listenTasksForChild(childId, cb) {
  const q = query(tasksCol, where("childId", "==", childId));
  return onSnapshot(q, (snap) => {
    const tasks = [];
    snap.forEach((d) => tasks.push({ id: d.id, ...d.data() }));
    tasks.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    cb(tasks);
  });
}

// ---------- LOGS ----------

// Live listener semua log milik satu anak (lintas tanggal). Cukup untuk skala keluarga.
export function listenLogsForChild(childId, cb) {
  const q = query(logsCol, where("childId", "==", childId));
  return onSnapshot(q, (snap) => {
    const logs = [];
    snap.forEach((d) => logs.push({ id: d.id, ...d.data() }));
    cb(logs);
  });
}

// Live listener semua log berstatus "submitted" (antrian approval admin, lintas anak).
export function listenPendingLogs(cb) {
  const q = query(logsCol, where("status", "==", "submitted"));
  return onSnapshot(q, (snap) => {
    const logs = [];
    snap.forEach((d) => logs.push({ id: d.id, ...d.data() }));
    logs.sort((a, b) => (a.submittedAt?.toMillis?.() || 0) - (b.submittedAt?.toMillis?.() || 0));
    cb(logs);
  });
}

// ---------- SALDO HARIAN (uang jajan) ----------
// MODEL: hasil kerja HARI INI menentukan jajan BESOK, bukan memotong saldo
// hari ini juga. Tiap hari jam 22:00 dianggap "tutup buku": tugas aktif hari
// itu yang telat kirim bukti kena potongan Rp500/5 menit (maks Rp1.500), dan
// yang sama sekali tidak ada buktinya kena Rp1.500. Total potongan hari itu
// dikurangkan dari jatah dasar (dailyAllowance) untuk jadi saldo BESOK.
//
// Karena hosting statis tidak bisa menjalankan sesuatu otomatis tepat jam
// 22:00, "tutup buku" ini baru benar-benar dieksekusi saat ada yang membuka
// dashboard admin/anak SETELAH jam 22:00 (atau di hari berikutnya). Untuk
// menampilkan gambaran ke anak SEBELUM ditutup resmi, dipakai
// computeLiveEvaluation() di bawah (hitungan sementara, bukan yang disimpan).
const MAX_CATCHUP_DAYS = 30; // jaga-jaga kalau lama tidak dibuka sama sekali

async function closeSaldoDay(childId, date, dailyAllowance) {
  const tSnap = await getDocs(query(tasksCol, where("childId", "==", childId)));
  const activeTasks = [];
  tSnap.forEach((d) => {
    const t = d.data();
    if (t.active && isTaskEligibleOnDate(t, date)) activeTasks.push({ id: d.id, title: t.title || "" });
  });

  const lSnap = await getDocs(query(logsCol, where("childId", "==", childId)));
  const logsForDate = new Map();
  lSnap.forEach((d) => { const l = d.data(); if (l.date === date) logsForDate.set(l.taskId, l); });

  // taskReport = rincian PER TUGAS untuk hari ini: dikerjakan tepat waktu,
  // telat, atau sama sekali tidak dikerjakan. Ini yang jadi bahan "Laporan
  // Harian" biar orang tua bisa evaluasi apa saja yang dikerjakan/tidak.
  const taskReport = activeTasks.map((t) => {
    const log = logsForDate.get(t.id);
    if (!log) {
      return { taskId: t.id, title: t.title, status: "missed", deduction: MISSED_TASK_DEDUCTION, lateMinutes: null };
    }
    const deduction = log.saldoDeduction ?? 0;
    return {
      taskId: t.id,
      title: t.title,
      status: deduction > 0 ? "late" : "done",
      deduction,
      lateMinutes: log.lateMinutes ?? 0
    };
  });

  const totalDeduction = taskReport.reduce((sum, r) => sum + r.deduction, 0);
  const missedTasks = taskReport.filter((r) => r.status === "missed").length;
  const lateTasks = taskReport.filter((r) => r.status === "late").length;
  const doneTasks = taskReport.filter((r) => r.status === "done").length;

  const nextDate = addDaysToDateStr(date, 1);
  // PENTING: jajan besok selalu dihitung dari jatah dasar (dailyAllowance)
  // dikurangi potongan HARI ITU SAJA — bukan dari sisa saldo hari sebelumnya.
  // Jadi tiap hari baru (mulai jam 22:01) selalu "reset" ke jatah penuh
  // dikurangi potongan hari itu, tidak pernah membawa sisa/utang dari hari lain.
  const saldoForNextDay = Math.max(0, dailyAllowance - totalDeduction);

  await setDoc(doc(db, "saldoHistory", `${childId}_${date}`), {
    childId,
    date,
    allowance: dailyAllowance,
    missedTasks,
    lateTasks,
    doneTasks,
    totalDeduction,
    saldoForNextDay,
    nextDate,
    taskReport,
    recordedAt: serverTimestamp()
  }, { merge: true });

  return { nextDate, saldoForNextDay };
}

// Pastikan saldo anak sudah "up to date": tutup buku semua hari yang jamnya
// sudah lewat 22:00 dan belum ditutup, lalu simpan saldo hasil akhirnya.
export async function ensureSaldoUpToDate(childId) {
  const childRef = doc(db, "children", childId);
  const snap = await getDoc(childRef);
  const data = snap.data() || {};
  const today = todayStr();
  const allowance = data.dailyAllowance ?? DEFAULT_ALLOWANCE[childId] ?? 0;

  if (!data.saldoDate) {
    // Pemakaian pertama kali: langsung isi jatah penuh untuk hari ini, belum ada histori.
    await updateDoc(childRef, { saldo: allowance, saldoDate: today, lastClosedDate: yesterdayStr() });
    return;
  }

  const now = new Date();
  const closeUpTo = now.getHours() >= SALDO_CLOSING_HOUR ? today : yesterdayStr();

  let cursor = data.lastClosedDate || addDaysToDateStr(data.saldoDate, -1);
  let latestSaldo = data.saldo ?? allowance;
  let latestSaldoDate = data.saldoDate;
  let closedAny = false;
  let guard = 0;

  while (cursor < closeUpTo && guard < MAX_CATCHUP_DAYS) {
    const dayToClose = addDaysToDateStr(cursor, 1);
    const { nextDate, saldoForNextDay } = await closeSaldoDay(childId, dayToClose, allowance);
    cursor = dayToClose;
    latestSaldo = saldoForNextDay;
    latestSaldoDate = nextDate;
    closedAny = true;
    guard += 1;
  }

  if (closedAny) {
    await updateDoc(childRef, { saldo: latestSaldo, saldoDate: latestSaldoDate, lastClosedDate: cursor });
  }
}

// Hitung gambaran SEMENTARA (belum resmi disimpan) potongan hari ini, dipakai
// untuk ditampilkan ke anak sebagai "perkiraan jajan besok" sebelum tutup
// buku jam 22:00. tasks = daftar tugas aktif anak, logs = semua log anak.
export function computeLiveEvaluation(tasks, logs, date, dailyAllowance) {
  const logsForDate = new Map();
  logs.forEach((l) => { if (l.date === date) logsForDate.set(l.taskId, l); });

  const now = new Date();
  const items = tasks.map((t) => {
    const log = logsForDate.get(t.id);
    if (log) {
      const deduction = log.saldoDeduction ?? 0;
      return { task: t, status: deduction > 0 ? "telat" : "selesai", deduction };
    }
    const target = timeStrToDateToday(t.time);
    if (now.getTime() < target.getTime()) {
      return { task: t, status: "belum-waktunya", deduction: 0 };
    }
    // Sudah lewat jamnya, belum ada bukti -> berisiko dianggap tidak dikerjakan
    // kalau sampai jam 22:00 tetap tidak ada bukti.
    return { task: t, status: "berisiko", deduction: MISSED_TASK_DEDUCTION };
  });

  const totalDeduction = items.reduce((sum, it) => sum + it.deduction, 0);
  const estimatedTomorrow = Math.max(0, dailyAllowance - totalDeduction);
  return { items, totalDeduction, estimatedTomorrow };
}

// Upload foto bukti ke ImgBB (hosting gambar gratis, pengganti Firebase Storage
// yang butuh paket berbayar Blaze). File difoto/dipilih di HP -> dikirim ke
// ImgBB -> ImgBB balikin URL publik -> URL itu yang disimpan di Firestore,
// sama persis alurnya seperti sebelumnya, cuma sumber upload-nya beda.
async function uploadPhotoToImgbb(file) {
  if (!IMGBB_API_KEY || IMGBB_API_KEY.startsWith("GANTI_DENGAN")) {
    throw new Error(
      "API key ImgBB belum diisi. Buka js/firebase.js, isi IMGBB_API_KEY dengan key gratis dari https://api.imgbb.com/"
    );
  }

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: formData
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Upload foto ke ImgBB gagal, coba lagi.");
  }

  return json.data.url;
}

// Upload foto bukti untuk satu tugas pada tanggal hari ini, lalu buat/timpa dokumen log.
// Kalau telat dari jam misi, potongannya dicatat di log (dipakai saat tutup
// buku jam 22:00 untuk menentukan jajan besok) — TIDAK langsung memotong
// saldo hari ini.
export async function submitTaskPhoto(task, childId, file) {
  await ensureSaldoUpToDate(childId); // pastikan saldo & histori sudah up to date dulu

  const date = todayStr();
  const photoUrl = await uploadPhotoToImgbb(file);

  const target = timeStrToDateToday(task.time);
  const lateMinutes = Math.max(0, Math.floor((Date.now() - target.getTime()) / 60000));
  const saldoDeduction = lateDeduction(lateMinutes);

  const logId = logIdFor(task.id, date);
  await setDoc(doc(db, "logs", logId), {
    taskId: task.id,
    taskTitle: task.title ?? "",
    childId,
    date,
    status: "submitted",
    photoUrl,
    xpReward: task.xpReward ?? 0,
    lateMinutes,
    saldoDeduction,
    submittedAt: serverTimestamp()
  }, { merge: true });

  return { logId, lateMinutes, saldoDeduction };
}

// Live listener histori saldo (hasil tutup buku tiap hari) milik satu anak.
export function listenSaldoHistory(childId, cb) {
  const q = query(collection(db, "saldoHistory"), where("childId", "==", childId));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    cb(items);
  });
}

// Admin menyetujui: update log jadi "approved" + tambah XP/level/streak ke dokumen children.
export async function approveLog(log) {
  await updateDoc(doc(db, "logs", log.id), {
    status: "approved",
    reviewedAt: serverTimestamp()
  });

  // Cek apakah SEMUA tugas aktif anak ini untuk tanggal log tsb sudah approved,
  // supaya streak hanya naik kalau satu hari penuh selesai.
  const allDone = await isFullyCompleteForDate(log.childId, log.date, log.taskId);

  const childRef = doc(db, "children", log.childId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(childRef);
    const data = snap.data() || {};
    const newXp = (data.xp ?? 0) + (log.xpReward ?? 0);
    const newCoin = (data.coin ?? 0) + (log.xpReward ?? 0);
    const update = {
      xp: newXp,
      coin: newCoin,
      level: computeLevel(newXp)
    };

    if (allDone) {
      const streakDate = data.streakDate;
      const y = yesterdayStr();
      let newStreak = 1;
      if (streakDate === y) newStreak = (data.streak ?? 0) + 1;
      else if (streakDate === log.date) newStreak = data.streak ?? 1; // sudah dihitung hari ini
      update.streak = newStreak;
      update.streakDate = log.date;
    }

    tx.update(childRef, update);
  });
}

export function rejectLog(logId, reviewNote) {
  return updateDoc(doc(db, "logs", logId), {
    status: "rejected",
    reviewNote: reviewNote || "",
    reviewedAt: serverTimestamp()
  });
}

// Helper: cek semua tugas aktif seorang anak pada tanggal tertentu sudah approved semua.
async function isFullyCompleteForDate(childId, date, justApprovedTaskId) {
  const tSnap = await getDocs(query(tasksCol, where("childId", "==", childId)));
  const activeTasks = [];
  tSnap.forEach((d) => {
    const t = d.data();
    if (t.active && isTaskEligibleOnDate(t, date)) activeTasks.push(d.id);
  });
  if (activeTasks.length === 0) return false;

  const lSnap = await getDocs(query(logsCol, where("childId", "==", childId)));
  const approvedTodaySet = new Set();
  lSnap.forEach((d) => {
    const l = d.data();
    if (l.date === date && (l.status === "approved" || d.id === logIdFor(justApprovedTaskId, date))) {
      approvedTodaySet.add(l.taskId);
    }
  });

  return activeTasks.every((taskId) => approvedTodaySet.has(taskId));
}

export async function updateChildHpStatus(childId, hpStatus) {
  await updateDoc(doc(db, "children", childId), { hpStatus });
}

export function updateChildField(childId, field, value) {
  return updateDoc(doc(db, "children", childId), { [field]: value });
}

// ---------- REWARDS (Phase 2: katalog tetap di kode, belum ada UI admin) ----------
export const REWARD_CATALOG = [
  { id: "jajan", icon: "🍔", title: "Jajan Favorit", cost: 100 },
  { id: "playtime", icon: "🎮", title: "Extra Play Time", cost: 150 },
  { id: "movie", icon: "🎬", title: "Nonton Film", cost: 200 },
  { id: "special", icon: "🎁", title: "Hadiah Khusus", cost: 500 }
];

// Tukar reward: kurangi "coin" anak lewat transaksi, lalu catat riwayatnya.
export async function redeemReward(childId, reward) {
  const childRef = doc(db, "children", childId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(childRef);
    const data = snap.data() || {};
    const coin = data.coin ?? 0;
    if (coin < reward.cost) {
      throw new Error("Coin belum cukup untuk reward ini.");
    }
    tx.update(childRef, { coin: coin - reward.cost });
  });

  await addDoc(collection(db, "redemptions"), {
    childId,
    rewardId: reward.id,
    rewardTitle: reward.title,
    rewardIcon: reward.icon,
    cost: reward.cost,
    redeemedAt: serverTimestamp()
  });
}

// Live listener riwayat penukaran reward seorang anak.
export function listenRedemptions(childId, cb) {
  const q = query(collection(db, "redemptions"), where("childId", "==", childId));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.redeemedAt?.toMillis?.() || 0) - (a.redeemedAt?.toMillis?.() || 0));
    cb(items);
  });
}
