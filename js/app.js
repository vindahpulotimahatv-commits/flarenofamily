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

// Potongan uang jajan per misi punya nominal MAKSIMAL yang diisi MANUAL oleh
// admin per tugas (mis. sholat = Rp2.000). Seberapa besar potongan yang benar-
// benar kena dihitung OTOMATIS dari keterlambatan:
//   - Telat kirim bukti -> potong Rp500 tiap kelipatan 5 menit telat,
//     berhenti bertambah di menit ke-30 — tapi tidak pernah melebihi nominal
//     potongan tugas itu sendiri (mis. sholat maks Rp2.000, walau rumus
//     5-menitannya bisa mencapai lebih).
//   - Telat lebih dari batas waktunya (lihat LATE_LIMIT_MIN di bawah) ->
//     misi dianggap TIDAK DIKERJAKAN, kena potongan PENUH (nominal yang
//     diisi admin untuk tugas itu).
//   - Total potongan semua misi hari itu dikurangkan dari jatah dasar ->
//     hasilnya jadi saldo BESOK.

// Batas telat DEFAULT: kalau sudah lewat 30 menit dari jam misi dan belum
// ada bukti, misi dianggap TIDAK DIKERJAKAN dan anak lanjut ke misi berikutnya.
export const LATE_LIMIT_MIN = 30;

// Batas telat khusus untuk misi yang memang butuh waktu lebih lama (mis.
// mandi) — ditandai lewat field task.extendedLateLimit = true di admin.
export const LATE_LIMIT_MIN_EXTENDED = 60;

// Aturan skala potongan otomatis per keterlambatan (nominalnya sendiri per
// tugas, lihat computeLateDeduction di bawah).
export const LATE_DEDUCTION_STEP_MIN = 5;   // tiap kelipatan 5 menit...
export const LATE_DEDUCTION_PER_STEP = 500; // ...potong Rp500...
export const LATE_DEDUCTION_CAP_MIN = 30;   // ...berhenti bertambah di menit ke-30.

// Batas telat efektif untuk sebuah misi: 60 menit kalau ditandai
// extendedLateLimit (mis. mandi), 30 menit untuk misi lainnya.
export function lateLimitForTask(task) {
  return task?.extendedLateLimit ? LATE_LIMIT_MIN_EXTENDED : LATE_LIMIT_MIN;
}

// true kalau misi (jam "HH:MM" hari ini) sudah telat melewati batas waktunya
// sendiri (30 menit normal, 60 menit kalau extendedLateLimit).
export function isPastLateLimit(timeStr, task) {
  const target = timeStrToDateToday(timeStr);
  return Date.now() - target.getTime() >= lateLimitForTask(task) * 60000;
}

// Hitung potongan otomatis (Rupiah) dari jumlah menit telat: Rp500 tiap
// kelipatan 5 menit, berhenti bertambah di menit ke-30, dan tidak pernah
// melebihi nominal potongan yang diisi admin untuk tugas itu (maxDeduction).
export function computeLateDeduction(lateMinutes, maxDeduction) {
  const steps = Math.min(
    Math.floor(Math.max(0, lateMinutes ?? 0) / LATE_DEDUCTION_STEP_MIN),
    LATE_DEDUCTION_CAP_MIN / LATE_DEDUCTION_STEP_MIN
  );
  const raw = steps * LATE_DEDUCTION_PER_STEP;
  return Math.min(raw, Math.max(0, maxDeduction ?? 0));
}

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
// PENTING: sengaja pakai jam LOKAL perangkat (getFullYear/getMonth/getDate),
// BUKAN toISOString() (yang konversi ke UTC dan bisa salah tanggal/jam kalau
// zona waktu perangkat bukan UTC). Ini memastikan tanggal & jam yang dipakai
// aplikasi selalu sama dengan tanggal & jam ASLI/REAL-TIME di perangkat.
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

// ---------- MISI BARU DIBUAT SETELAH JAMNYA LEWAT HARI INI ----------
// Kalau admin menambah misi jam 17:44 dengan target jam 08:00, misi itu
// otomatis berulang tiap hari (tidak perlu diisi ulang) TAPI kalau langsung
// dievaluasi untuk HARI INI, statusnya pasti "TERLAMBAT" padahal anak belum
// pernah punya kesempatan mengerjakannya. Fungsi ini menentukan tanggal
// pertama misi itu "berlaku": kalau jam targetnya hari ini sudah lewat saat
// dibuat, misi baru berlaku mulai BESOK; kalau belum lewat, berlaku mulai
// hari ini juga.
export function computeFirstEligibleDate(timeStr) {
  const target = timeStrToDateToday(timeStr);
  const today = todayStr();
  if (Date.now() > target.getTime()) {
    return addDaysToDateStr(today, 1);
  }
  return today;
}

// Cek apakah sebuah misi sudah "berlaku" untuk tanggal tertentu (dipakai
// supaya misi yang baru dibuat setelah jamnya lewat hari ini tidak langsung
// muncul sebagai TERLAMBAT di hari yang sama).
export function isTaskEligibleOnDate(task, dateStr) {
  if (!task.firstEligibleDate) return true; // misi lama (sebelum update ini)
  return dateStr >= task.firstEligibleDate;
}
