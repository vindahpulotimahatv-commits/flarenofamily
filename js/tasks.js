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
import { todayStr, yesterdayStr, computeLevel } from "./app.js";

const tasksCol = collection(db, "tasks");
const logsCol = collection(db, "logs");

export function logIdFor(taskId, date) {
  return `${taskId}_${date}`;
}

// ---------- TASKS ----------

export async function createTask(childId, { title, description, time, xpReward, category }) {
  return addDoc(tasksCol, {
    childId,
    title: title.trim(),
    description: (description || "").trim(),
    time,
    category: category || "belajar",
    xpReward: Number(xpReward) || 0,
    active: true,
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
export async function submitTaskPhoto(task, childId, file) {
  const date = todayStr();
  const photoUrl = await uploadPhotoToImgbb(file);

  const logId = logIdFor(task.id, date);
  await setDoc(doc(db, "logs", logId), {
    taskId: task.id,
    taskTitle: task.title ?? "",
    childId,
    date,
    status: "submitted",
    photoUrl,
    xpReward: task.xpReward ?? 0,
    submittedAt: serverTimestamp()
  }, { merge: true });

  return logId;
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
    if (t.active) activeTasks.push(d.id);
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
