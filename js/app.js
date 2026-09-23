// js/app.js
// -----------------------------------------------------------
// File ini sengaja masih kosong di Phase 1.
// Nanti dipakai untuk fungsi-fungsi umum yang dipakai
// di banyak halaman (format tanggal, format uang, dll)
// saat kita masuk Phase 2 (Tugas, Jadwal, Reminder).
// -----------------------------------------------------------

export function formatRupiah(angka) {
  return "Rp" + (angka ?? 0).toLocaleString("id-ID");
}
