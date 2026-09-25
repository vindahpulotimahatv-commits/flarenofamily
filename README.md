# 🎯 Misi Harian Keluarga — Phase 1

Panduan ini untuk kamu yang baru pertama kali pakai Firebase. Ikuti urutan dari atas ke bawah, jangan loncat.

---

## BAGIAN A — SETUP FIREBASE (lakukan dulu, sebelum yang lain)

### 1. Buat Firebase Project
1. Buka https://console.firebase.google.com
2. Klik **Add project**
3. Beri nama misalnya `misi-harian-keluarga`
4. Google Analytics boleh dimatikan (tidak wajib)
5. Klik **Create project**

### 2. Aktifkan Authentication
1. Di sidebar kiri klik **Build > Authentication**
2. Klik **Get started**
3. Pilih **Email/Password** > aktifkan (toggle ON) > Save

### 3. Aktifkan Firestore
1. Sidebar > **Build > Firestore Database**
2. Klik **Create database**
3. Pilih mode **Production mode**
4. Pilih lokasi server (misalnya `asia-southeast2` / Jakarta) > Enable

### 4. (Dilewati) Storage Firebase TIDAK dipakai
Firebase Storage butuh paket berbayar **Blaze**, jadi project ini
**tidak** pakai Firebase Storage sama sekali. Foto bukti tugas
di-upload ke **ImgBB** (gratis selamanya, tanpa kartu kredit) —
setup-nya ada di langkah 5b di bawah. Lewati langkah "Aktifkan
Storage" di Firebase Console.

### 5. Tambahkan Web App (untuk website admin)
1. Di halaman utama project, klik ikon **</>** (Web)
2. Beri nama misalnya `misi-harian-web`
3. **Jangan** centang Firebase Hosting (kita pakai GitHub Pages)
4. Klik **Register app**
5. Firebase akan menampilkan `firebaseConfig` — **copy semua isinya**
6. Buka file `website/js/firebase.js` di project ini, ganti bagian `GANTI_DENGAN_...` dengan nilai yang kamu copy tadi

### 5b. Setup ImgBB (untuk upload foto bukti, GRATIS)
1. Buka https://api.imgbb.com/
2. Login pakai email atau akun Google
3. Setelah masuk dashboard, copy **API key** yang ditampilkan
4. Buka file `website/js/firebase.js`, cari `IMGBB_API_KEY` dan
   tempel API key tadi menggantikan `"GANTI_DENGAN_API_KEY_IMGBB_KAMU"`
5. Selesai — tidak perlu isi kartu kredit apapun, ImgBB gratis selamanya

### 6. Buat User Pertama (admin, Khanaya, Asensio)
1. Sidebar > **Authentication > Users > Add user**
2. Buat 3 akun, contoh:
   - `admin@keluarga.com` / password bebas (min 6 karakter)
   - `khanaya@keluarga.com` / password bebas
   - `asensio@keluarga.com` / password bebas
3. Catat **UID** dari setiap user yang baru dibuat (klik usernya untuk melihat UID)

### 7. Isi Collection `users` di Firestore
1. Sidebar > **Firestore Database > Start collection**
2. Collection ID: `users`
3. Document ID: **paste UID admin** dari langkah sebelumnya
4. Tambahkan field:
   - `role` (string) = `admin`
   - `name` (string) = `Ayah/Bunda`
   - `childId` (string) = kosongkan saja (boleh string kosong)
5. Ulangi untuk Khanaya (Document ID = UID Khanaya):
   - `role` = `khanaya`
   - `name` = `Khanaya`
   - `childId` = `khanaya`
6. Ulangi untuk Asensio (Document ID = UID Asensio):
   - `role` = `asensio`
   - `name` = `Asensio`
   - `childId` = `asensio`

### 8. Isi Collection `children` di Firestore
1. **Start collection** > Collection ID: `children`
2. Document ID: `khanaya`
   - `name` (string) = `Khanaya`
   - `emoji` (string) = `👧`
   - `xp` (number) = `0`
   - `level` (number) = `1`
   - `streak` (number) = `0`
   - `saldo` (number) = `0`
   - `hpStatus` (string) = `aktif`
3. Document ID: `asensio` — isi field yang sama, sesuaikan nama & emoji `👦`

### 9. Pasang Firestore Rules
1. Sidebar > **Firestore Database > Rules**
2. Hapus isi default, ganti dengan isi file `website/firestore.rules` dari project ini
3. Klik **Publish**
4. (File `website/storage.rules` tidak perlu dipasang — Storage tidak dipakai lagi)

---

## BAGIAN B — JALANKAN WEBSITE ADMIN (lokal, sebelum upload ke GitHub)

Karena file menggunakan `type="module"`, kamu **tidak bisa** buka `index.html` dengan cara double-click biasa (harus lewat server lokal, walau sederhana).

Cara termudah pakai **VS Code + extension "Live Server"**:
1. Install VS Code
2. Buka folder `website/`
3. Install extension **Live Server**
4. Klik kanan `index.html` > **Open with Live Server**
5. Browser akan terbuka otomatis, coba login pakai `admin@keluarga.com`

### Testing yang harus dicoba:
- Login sebagai admin → harus masuk ke `admin.html` dan melihat 2 card anak (Khanaya & Asensio)
- Logout → harus kembali ke halaman login
- Login sebagai `khanaya@keluarga.com` → harus masuk ke `child.html`, bukan `admin.html`

---

## BAGIAN C — UPLOAD KE GITHUB PAGES

1. Buat repository baru di GitHub, misalnya `misi-harian-keluarga`
2. Upload **isi folder `website/`** (bukan foldernya, tapi isinya: `index.html`, `admin.html`, `css/`, `js/`, dst) ke root repository
   - Bisa lewat `git push`, atau lewat tombol **Add file > Upload files** di GitHub
3. Di repository, buka **Settings > Pages**
4. Source: pilih branch `main`, folder `/ (root)` > Save
5. Tunggu 1-2 menit, GitHub akan memberi link seperti:
   `https://username.github.io/misi-harian-keluarga/`
6. Buka link itu, coba login lagi seperti di Bagian B

---

## BAGIAN D — SETUP ANDROID APP (Khanaya & Asensio)

### 1. Buat Project di Android Studio
1. Buka Android Studio > **New Project > Empty Views Activity**
2. Name: `MisiHarian`
3. Package name: `com.keluarga.misiharian`
4. Language: **Kotlin**
5. Minimum SDK: **API 24**

### 2. Hubungkan ke Firebase
1. Di Android Studio: **Tools > Firebase**
2. Pilih **Authentication > Email and password** > klik **Connect to Firebase** (pilih project `misi-harian-keluarga` yang sama seperti di Bagian A) > **Add Authentication to your app**
3. Ulangi untuk **Firestore** dan **Storage** lewat menu Firebase Assistant yang sama
4. Ini otomatis mendownload file `google-services.json` ke folder `app/`
5. Buka `app/build.gradle.kts`, tambahkan isi dari file `android/app-build.gradle.kts` di project ini (dependency Firebase, viewBinding, dst)
6. Klik **Sync Now**

### 3. Tambahkan File Kotlin
Salin isi setiap file ini ke lokasi yang tertulis di baris paling atas masing-masing file:
- `android/MainActivity.kt` → `app/src/main/java/com/keluarga/misiharian/ui/MainActivity.kt`
- `android/LoginActivity.kt` → `app/src/main/java/com/keluarga/misiharian/ui/LoginActivity.kt`
- `android/ChildDashboardActivity.kt` → `app/src/main/java/com/keluarga/misiharian/ui/ChildDashboardActivity.kt`
- `android/FirestoreRepository.kt` → `app/src/main/java/com/keluarga/misiharian/data/FirestoreRepository.kt`

Lalu buat layout XML sederhana untuk `activity_login.xml` (EditText email, EditText password, Button) dan `activity_child_dashboard.xml` (beberapa TextView) — bagian ini kita buat lengkap dengan tampilan game di **Phase 3**. Untuk sekarang cukup layout sederhana supaya bisa dites.

Tambahkan juga di `AndroidManifest.xml`, daftarkan `LoginActivity` dan `ChildDashboardActivity` sebagai `<activity>`, dan jadikan `MainActivity` sebagai launcher activity.

### 4. Testing
1. Jalankan app di emulator atau HP Android
2. Harus terbuka `LoginActivity`
3. Login pakai `khanaya@keluarga.com`
4. Harus pindah ke `ChildDashboardActivity` (isi data XP/streak masih 0, itu normal)
5. Tutup app, buka lagi → harus langsung masuk dashboard tanpa login ulang (karena Firebase Auth menyimpan sesi)

---

## Status Phase 1

✅ Struktur project (web + Android)
✅ Firebase project + Authentication + Firestore aktif (Storage tidak
   dipakai, upload foto pakai ImgBB gratis)
✅ Login & role system (admin / khanaya / asensio)
✅ Admin dashboard sederhana (lihat data dasar 2 anak)
✅ Child dashboard sederhana (web utk testing + kerangka Android)
✅ Firestore Security Rules dasar

---

## BAGIAN E — PHASE 2: TUGAS, REMINDER, UPLOAD BUKTI, HP STATUS

### 1. Update Firestore Rules
File `firestore.rules` sudah ditambah aturan untuk collection baru
`tasks` dan `logs`.
1. Firebase Console > **Firestore Database > Rules** > copy-paste ulang isi
   `firestore.rules` yang baru > **Publish**

Upload foto bukti tugas pakai **ImgBB** (lihat langkah 5b di Bagian A),
jadi tidak perlu Storage Rules sama sekali.

Tidak perlu bikin collection `tasks`/`logs` manual — akan otomatis
terbentuk saat admin menambah tugas pertama lewat dashboard.

### 2. Apa yang baru
- **Admin Dashboard** (`admin.html`): tiap kartu anak sekarang punya
  - Field **Kelas** (opsional, tampil di halaman Profil anak)
  - Dropdown untuk mengganti **Status HP** (🟢 aktif / 🟡 terbatas / 🔴 terkunci / ⏳ habis)
  - Form tambah tugas (nama, **kategori** 🌅🙏🏫📚🏠🌙📱, jam, reward XP,
    **potongan maks (Rp)**, centang 🛁 opsional untuk batas telat 1 jam) + daftar
    tugas (bisa dinonaktifkan ⏸️ atau dihapus 🗑️)
  - Bagian **Approval Bukti Foto** di bawah: lihat foto yang dikirim anak,
    tinggal klik ✅ Setujui (otomatis nambah XP, level, koin, dan streak) atau
    ❌ Tolak (anak bisa upload ulang)
- **Child Dashboard** (`child.html`) — **dirombak total jadi tampilan GAME**:
  - Header dengan avatar/emoji + sapaan santai, tombol ⚙️ ke profil
  - **Kartu Level** besar (gradient ungu) dengan progress bar XP
  - **Kartu Streak** 🔥 dan **Kartu Status HP** 📱 berdampingan
  - **Misi Sekarang**: tugas terdekat yang belum selesai, dengan **countdown
    real-time per detik** (bukan refresh halaman) dan badge status berubah
    otomatis: ⏳ Mulai dalam → ⚠️ Sebentar lagi → 🔥 Waktunya! → ⚠️ Terlambat
  - **Peta Petualangan Harian**: daftar tugas hari ini jadi jalur
    ✅ selesai / 🔵 sekarang / 🔒 belum waktunya
  - Tab **Misi**: semua misi hari ini sebagai mission card, tekan untuk buka
    detail (modal) → deskripsi, jam, reward, tombol **Ambil Foto** /
    **Pilih dari Galeri** dengan preview sebelum **Kirim Bukti**
  - Tab **Reward** 🎁: katalog reward (Jajan/Extra Play/Nonton Film/Hadiah
    Khusus) yang bisa ditukar pakai **koin** (koin bertambah tiap misi
    disetujui, terpisah dari XP total supaya level tidak pernah turun) +
    riwayat penukaran
  - Tab **Badge** 🏅: badge otomatis (3/7 Hari Beruntun, Rajin Belajar, Jago
    Beres-beres, Tepat Waktu, Mission Master) — abu-abu/terkunci kalau
    belum tercapai
  - Tab **Profil** 👤: ringkasan lengkap + tombol Keluar
  - **Bottom navigation** 🏠🎯🎁🏆👤 khas aplikasi mobile
  - Animasi ringan 🎉 "Misi Selesai! +XP" begitu admin menyetujui foto
  - **Reminder**: banner + coba kirim notifikasi browser 15 menit sebelum
    jam misi. Ini hanya jalan **selama halaman terbuka** — notifikasi push
    sungguhan (walau app ditutup) baru bisa dibuat di Android App (Phase 3),
    karena butuh Firebase Cloud Messaging.
  - Semua istilah teknis (Firestore, collection, dst) **tidak** tampil ke
    anak — bahasa yang dipakai: "Mulai Misi", "Kirim Bukti", "Misi Selesai!", dst.

### 3. Asumsi yang saya ambil (penting dibaca)
- **Koin vs XP**: XP itu total seumur hidup (dipakai untuk Level, tidak
  pernah berkurang). Koin itu saldo yang bisa dibelanjakan di Reward — naik
  bareng XP tiap misi disetujui, dan berkurang saat ditukar reward. Ini
  supaya level anak tidak pernah "turun" gara-gara jajan reward.
- **Katalog reward** masih di dalam kode (`js/tasks.js` → `REWARD_CATALOG`),
  belum ada halaman admin untuk mengatur reward — kalau mau ubah nama/harga
  reward, edit array itu langsung. UI admin untuk kelola reward bisa
  dibuatkan di Phase 3 kalau perlu.
- **Badge** dihitung otomatis dari data yang sudah ada (streak, kategori
  tugas, ketepatan waktu), bukan collection Firestore terpisah.
- **Kategori tugas** (`category`) field baru di collection `tasks` — tugas
  lama (dibuat sebelum update ini) otomatis dianggap kategori "belajar" 📚
  sampai diedit ulang lewat admin.

### 4. Cara memasang & cara test tampilan game di HP
1. Publish ulang `firestore.rules` & `storage.rules` seperti langkah 1 di atas
   (ada perubahan baru: anak boleh update field `coin` sendiri, + collection `redemptions`)
2. Upload/replace semua file di GitHub Pages seperti biasa (Bagian C)
3. Di HP Android, buka link GitHub Pages-nya di **Chrome**
4. Login pakai akun Khanaya/Asensio → harus langsung muncul dashboard game
   (kartu Level ungu, kartu Streak & HP, Misi Sekarang, dst), **bukan** lagi
   tulisan "Ini adalah versi web sementara..."
5. Coba tap **bottom navigation** (🏠🎯🎁🏆👤) — pastikan tiap tab pindah tanpa reload
6. Tap salah satu mission card → modal detail terbuka → coba **Ambil Foto**
   (harus membuka kamera HP) dan **Pilih dari Galeri** → preview muncul →
   **Kirim Bukti**

### 5. Cara kerja Level, Koin & Streak
- **Level** dihitung otomatis dari XP: tiap 100 XP = naik 1 level. Tidak
  perlu diisi manual.
- **Koin** 🪙 terpisah dari XP: dipakai untuk tukar reward, bisa naik-turun,
  tidak memengaruhi level.
- **Streak** naik +1 hanya kalau **semua tugas aktif** anak pada hari itu
  sudah disetujui admin, dan hari sebelumnya juga lengkap (berurutan).
  Kalau ada hari yang bolong, streak mulai dari 1 lagi di hari berikutnya
  yang lengkap. (Catatan: karena hosting statis di GitHub Pages tidak
  punya Cloud Functions, streak **tidak otomatis reset** kalau anak absen
  total di suatu hari — ini akan disempurnakan lewat Cloud Functions kalau
  nanti upgrade ke Firebase Blaze plan.)

### 6. Checklist testing lengkap
- [ ] Login admin → tambah 1-2 tugas untuk Khanaya (nama, kategori, jam, XP)
- [ ] Login sebagai Khanaya → dashboard game muncul, tugas ada di tab Misi
      & di Peta Petualangan
- [ ] Ubah jam tugas ke waktu dekat (misal 5 menit dari sekarang) lewat admin →
      refresh halaman anak → **Misi Sekarang** menampilkan countdown yang
      berjalan tiap detik, banner reminder muncul
- [ ] Tap mission card → modal terbuka → ambil/pilih foto → preview tampil →
      Kirim Bukti → status berubah jadi "⏳ MENUNGGU ORANG TUA"
- [ ] Login admin → foto muncul di **Approval Bukti Foto** → klik **Setujui**
- [ ] Login lagi sebagai anak → animasi 🎉 "MISI SELESAI! +XP" muncul, XP &
      koin bertambah, level naik kalau lewat kelipatan 100
- [ ] Kalau semua misi hari itu approved → cek streak naik +1
- [ ] Tab Reward → coba tukar reward pakai koin, cek koin berkurang & riwayat
      muncul
- [ ] Tab Badge → cek badge yang syaratnya sudah terpenuhi tidak lagi abu-abu
- [ ] Tab Profil → data lengkap tampil, tombol Keluar berfungsi
- [ ] Coba ganti Status HP dari admin → cek kartu HP di dashboard anak ikut berubah
- [ ] Pastikan login admin tetap tampil dashboard profesional (tidak berubah)

---

## BAGIAN F — SALDO UANG JAJAN HARIAN (potongan otomatis per nominal tugas)

### 1. Cara kerjanya (MODEL: hasil hari ini nentuin jajan BESOK)
- **Jatah dasar**: Khanaya Rp25.000/hari, Asensio Rp20.000/hari (default kalau
  field `dailyAllowance` belum diisi). Admin bisa ubah lewat input
  **"Jatah Uang Jajan Harian"** di kartu tiap anak pada `admin.html`.
- **Nominal potongan per tugas**: saat menambah misi, admin mengisi manual
  **"Potongan maks (Rp)"** untuk misi itu (mis. misi "Sholat" = Rp2.000). Ini
  nominal yang kena potong penuh kalau misi itu SAMA SEKALI tidak dikerjakan.
  Nominal ini bisa diubah kapan saja lewat kotak angka di daftar tugas admin.
- **Batas telat per misi**: normal 30 menit dari jadwal. Untuk misi yang
  memang butuh waktu lebih lama (mis. mandi), centang **"🛁 Butuh waktu lebih
  lama"** saat menambah misi di admin → batasnya jadi 1 jam.
- **Jam 22:00 = "tutup buku"**: setiap hari jam 22:00, sistem menghitung semua
  tugas aktif hari itu — potongannya OTOMATIS berdasarkan keterlambatan,
  tidak ada isian manual per hari:
  - Telat kirim bukti → potong Rp500 tiap kelipatan 5 menit telat, berhenti
    bertambah di menit ke-30 — tapi tidak pernah melebihi nominal "Potongan
    maks" tugas itu. Contoh: misi "Sholat" (potongan maks Rp2.000) telat 15
    menit → potong Rp1.500; telat 25 menit → potong Rp2.000 (sudah mentok
    nominal maksnya, walau rumus 5-menitan seharusnya Rp2.500).
  - Telat melebihi batasnya sendiri (30 menit, atau 60 menit untuk misi 🛁)
    tanpa bukti sama sekali → dianggap **tidak menyelesaikan tugas**, kena
    potongan PENUH (nominal "Potongan maks" tugas itu).
  - Total potongan semua misi hari itu dikurangkan dari **jatah dasar** →
    hasilnya jadi **saldo BESOK**. Contoh: misi "Sholat" (potongan maks
    Rp2.000) tidak dikerjakan sama sekali →
    jajan besok Khanaya = Rp25.000 − Rp2.000 = **Rp23.000**.
  - Potongan HARI INI tidak mengurangi saldo hari ini — saldo hari ini sudah
    "dikunci" sejak tutup buku hari sebelumnya.
- **Perkiraan real-time**: anak bisa lihat perkiraan potongan hari ini &
  perkiraan jajan besok kapan saja lewat tab **Profil → Evaluasi Hari Ini**
  (lengkap dengan tanggal), sebelum resmi dihitung jam 22:00.
- **Riwayat**: tab **Profil → Riwayat Jajan** menampilkan rekap tiap hari yang
  sudah ditutup (potongan & hasil jajan hari berikutnya), disimpan di
  collection `saldoHistory/{childId_tanggal}`.
- Field baru di `children/{childId}`: `saldo` (saldo yang berlaku hari ini,
  hasil tutup buku kemarin), `saldoDate` (tanggal saldo itu berlaku),
  `lastClosedDate` (tanggal terakhir yang sudah ditutup buku), `dailyAllowance`
  (opsional, jatah dasar custom).

### 2. Catatan jujur soal batasannya
Karena hosting statis (GitHub Pages) tidak punya Cloud Functions yang jalan
otomatis tepat jam 22:00, "tutup buku" baru benar-benar dieksekusi saat admin
ATAU anak membuka dashboard **setelah** jam 22:00 (atau di hari-hari
berikutnya — sistem akan "mengejar" ketinggalan hari yang belum ditutup
secara berurutan). Kalau tidak ada yang buka web sama sekali di malam hari,
angka final tetap baru muncul saat dashboard dibuka lagi. Sebelum jam 22:00,
angka yang tampil di tab Evaluasi cuma **perkiraan** (bisa berubah kalau anak
masih sempat kirim bukti). Ini sama sifatnya dengan batasan streak yang sudah
dijelaskan di atas.

### 3. Setelah update ini
1. Publish ulang `firestore.rules` yang baru (ada aturan tambahan untuk field
   `saldo`, `saldoDate`, `lastClosedDate`, dan collection `saldoHistory`) —
   Firebase Console > Firestore Database > Rules > Publish.
2. Upload ulang semua file ke GitHub Pages seperti biasa (Bagian C).
3. Tidak perlu isi apa-apa manual di Firestore — field saldo akan otomatis
   terbentuk saat dashboard pertama kali dibuka.

---

## Status Phase 2

✅ Sistem tugas & jadwal (CRUD tugas per anak + kategori, admin dashboard)
✅ Dashboard anak bergaya GAME (Level card, Streak, Misi Sekarang, Peta
   Petualangan, tab Misi/Reward/Badge/Profil, bottom navigation)
✅ Countdown real-time per detik + reminder 15 menit (banner + notifikasi browser)
✅ Upload foto bukti (kamera/galeri + preview) + approval (XP/koin otomatis bertambah)
✅ Level otomatis dari XP, koin terpisah untuk reward, streak harian
✅ Reward shop + riwayat penukaran
✅ Badge otomatis (6 jenis, dihitung dari data yang ada)
✅ Kontrol status HP manual oleh admin (aktif/terbatas/terkunci/habis) —
   ditampilkan apa adanya ke anak, TIDAK benar-benar mengunci HP (itu tugas Android App)

**Belum dibuat (menyusul di Phase 3 — Android App):**
- Notifikasi push sungguhan walau app ditutup (Firebase Cloud Messaging)
- Countdown & penguncian HP otomatis di level sistem Android (Device Admin / Screen Time API)
- Halaman admin untuk mengatur katalog reward (saat ini masih hardcode di kode)
- Avatar foto asli (saat ini masih pakai emoji)

Kalau semua langkah di atas sudah berhasil, ketik **"LANJUT PHASE 3"**
untuk mulai membangun Android App-nya.
