// js/app.js
// -----------------------------------------------------------
// Fungsi umum yang dipakai di banyak halaman:
// format tanggal, format uang, hitung level, dll.
// -----------------------------------------------------------

export function formatRupiah(angka) {
  return "Rp" + (angka ?? 0).toLocaleString("id-ID");
}

// ---------- SALDO / UANG JAJAN HARIAN ----------
// Jatah default per anak kalau field "dailyAllowance" belum diisi di Firestore.
export const DEFAULT_ALLOWANCE = { khanaya: 25000, asensio: 20000 };

// Potongan karena TELAT kirim bukti: Rp500 tiap kelipatan 5 menit telat,
// maksimal Rp1.500 (batas maksimal ini tercapai di menit ke-15 dan seterusnya).
// Contoh: telat 1-5 menit = -Rp500, telat 6-10 menit = -Rp1.000, telat 11-15
// menit (atau lebih) = -Rp1.500.
export function lateDeduction(lateMinutes) {
  if (!lateMinutes || lateMinutes <= 0) return 0;
  const steps = Math.min(3, Math.ceil(lateMinutes / 5));
  return steps * 500;
}

// Potongan karena SAMA SEKALI TIDAK dikerjakan (tidak ada bukti terkirim
// sampai hari itu berakhir): flat Rp1.500 per tugas.
export const MISSED_TASK_DEDUCTION = 1500;

// Waktu "tutup buku" evaluasi harian: jam 22:00. Setelah jam ini, tugas hari
// itu yang belum ada buktinya dianggap "tidak dikerjakan" dan dipakai untuk
// menentukan jajan BESOK (bukan memotong saldo hari ini).
export const SALDO_CLOSING_HOUR = 22;

// Ubah "YYYY-MM-DD" jadi Date (jam 00:00 lokal).
export function dateStrToDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "YYYY-MM-DD" + n hari -> "YYYY-MM-DD" baru.
export function addDaysToDateStr(dateStr, days) {
  const d = dateStrToDate(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Format tanggal "YYYY-MM-DD" jadi lebih enak dibaca, mis. "23 Sep 2026".
export function formatTanggal(dateStr) {
  if (!dateStr) return "";
  const d = dateStrToDate(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Tanggal hari ini dalam format "YYYY-MM-DD" (dipakai sebagai bagian ID log).
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Tanggal kemarin, format sama seperti todayStr(). Dipakai untuk cek streak.
export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Ubah "HH:MM" jadi Date object hari ini pada jam tsb.
export function timeStrToDateToday(timeStr) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// Sisa menit dari sekarang ke jam target hari ini (bisa negatif kalau sudah lewat).
export function minutesUntil(timeStr) {
  const target = timeStrToDateToday(timeStr);
  return Math.floor((target.getTime() - Date.now()) / 60000);
}

// Level dihitung otomatis dari XP: setiap 100 XP = naik 1 level.
export function computeLevel(xp) {
  return Math.floor((xp ?? 0) / 100) + 1;
}

// XP yang sudah terkumpul di level saat ini (untuk progress bar), skala 0-100.
export function xpProgressInLevel(xp) {
  return (xp ?? 0) % 100;
}

const STATUS_LABEL = {
  aktif: "🟢 HP AKTIF",
  terbatas: "🟡 HP TERBATAS",
  terkunci: "🔴 HP TERKUNCI",
  habis: "⏳ WAKTU HABIS"
};
export function hpStatusLabel(status) {
  return STATUS_LABEL[status] || STATUS_LABEL.aktif;
}

const HP_MESSAGE = {
  aktif: "Semua aman, main sewajarnya ya!",
  terbatas: "Selesaikan misi untuk membuka kembali.",
  terkunci: "Tugas belum diselesaikan.",
  habis: "Waktu HP hari ini sudah habis."
};
export function hpStatusMessage(status) {
  return HP_MESSAGE[status] || HP_MESSAGE.aktif;
}

// ---------- KATEGORI MISI ----------
export const CATEGORY_META = {
  pagi:    { icon: "🌅", label: "Pagi" },
  ibadah:  { icon: "🙏", label: "Ibadah" },
  sekolah: { icon: "🏫", label: "Sekolah" },
  belajar: { icon: "📚", label: "Belajar" },
  rumah:   { icon: "🏠", label: "Rumah" },
  malam:   { icon: "🌙", label: "Malam" },
  hp:      { icon: "📱", label: "HP" }
};
export function categoryIcon(cat) {
  return (CATEGORY_META[cat] || { icon: "🎯" }).icon;
}
export function categoryLabel(cat) {
  return (CATEGORY_META[cat] || { label: "Misi" }).label;
}

// ---------- COUNTDOWN ----------
// Format ms sisa jadi "HH:MM:SS". ms negatif -> "00:00:00".
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// Target Date object untuk jam "HH:MM" hari ini (dipakai buat countdown per detik).
