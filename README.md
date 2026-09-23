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

### 4. Aktifkan Storage
1. Sidebar > **Build > Storage**
2. Klik **Get started** > pilih Production mode > pilih lokasi yang sama seperti Firestore > Done

### 5. Tambahkan Web App (untuk website admin)
1. Di halaman utama project, klik ikon **</>** (Web)
2. Beri nama misalnya `misi-harian-web`
3. **Jangan** centang Firebase Hosting (kita pakai GitHub Pages)
4. Klik **Register app**
5. Firebase akan menampilkan `firebaseConfig` — **copy semua isinya**
6. Buka file `website/js/firebase.js` di project ini, ganti bagian `GANTI_DENGAN_...` dengan nilai yang kamu copy tadi

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

### 9. Pasang Firestore & Storage Rules
1. Sidebar > **Firestore Database > Rules**
2. Hapus isi default, ganti dengan isi file `website/firestore.rules` dari project ini
3. Klik **Publish**
4. Sidebar > **Storage > Rules**
5. Ganti isinya dengan isi file `website/storage.rules`
6. Klik **Publish**

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
✅ Firebase project + Authentication + Firestore + Storage aktif
✅ Login & role system (admin / khanaya / asensio)
✅ Admin dashboard sederhana (lihat data dasar 2 anak)
✅ Child dashboard sederhana (web utk testing + kerangka Android)
✅ Firestore Security Rules dasar

**Belum dibuat (menyusul di Phase 2):**
- Sistem tugas & jadwal
- Reminder 15 menit + notifikasi
- Upload foto bukti + approval
- Countdown & mode HP terbatas/terkunci

Kalau semua langkah di atas sudah berhasil dan bisa login + lihat dashboard, ketik **"LANJUT PHASE 2"** untuk lanjut ke sistem tugas & jadwal.
