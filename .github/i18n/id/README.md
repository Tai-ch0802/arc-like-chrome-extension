# Sidebar Chrome bergaya Arc

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

Ini adalah proyek ekstensi Chrome yang bertujuan untuk menghadirkan pengalaman sidebar vertikal seperti browser Arc ke Google Chrome, menyediakan panel yang terpadu dan kuat untuk mengelola tab dan bookmark.

## 🚀 Pembaruan Rilis Baru v1.11.0!
[![Video Demo](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

### ⚡️ Fitur
- **Tab Vertikal**: Lihat judul halaman lengkap, tidak lagi terkompresi menjadi ikon kecil.
- **Grup Tab**: Terintegrasi sempurna dengan Grup Tab Chrome, menyinkronkan warna dan nama.
- **Integrasi Bookmark**: Panel terpadu untuk mengelola tab dan bookmark.
- **Tab Terkait**: Secara otomatis membuat "Tautan" saat membuka bookmark, membantu menghindari pembukaan ganda.
- **Pencarian Antar Jendela**: Cari tab dan bookmark di semua jendela Chrome yang terbuka.
- **Rendering Dinamis**: Rendering efisien untuk pustaka bookmark yang besar.

## 🤝 Berkontribusi

Kami menyambut kontribusi dari komunitas! Baik Anda memperbaiki bug, meningkatkan dokumentasi, atau mengusulkan fitur baru, bantuan Anda sangat dihargai.

Kami menggunakan alur kerja **Spec-Driven Development (SDD)** dan bersifat **ramah AI**. Lihat panduan kontribusi kami untuk memulai:

👉 **[Baca Panduan Kontribusi Kami](./CONTRIBUTING.md)**

---

## 🔥 Fitur Utama

### 🔗 Inovasi Eksklusif: Tab Terkait (Linked Tabs)
Ini adalah fitur kami yang paling kuat! Saat Anda membuka bookmark dari sidebar, kami secara otomatis membuat **"Tautan"**.
- **Hindari Kekacauan Tab**: Klik ikon tautan di samping bookmark untuk melihat semua tab yang dibuka darinya, membantu Anda menghindari pembukaan ganda dan menghemat sumber daya sistem.
- **Sinkronisasi Dua Arah**: Saat tab ditutup, status bookmark diperbarui secara otomatis; saat bookmark dihapus, tab terkait ditangani secara cerdas.
- **Umpan Balik Visual**: Ikon tautan yang apik muncul di samping bookmark, memberi tahu Anda secara sekilas mana yang sedang aktif.

### ⚡️ Rendering Cerdas
Punya ribuan bookmark? Tidak masalah!
- **Rendering Dinamis**: Beralih dari Virtual Scrolling ke mekanisme Rendering Dinamis yang efisien, memastikan performa mulus dengan kompatibilitas yang lebih baik.
- **Pengalaman Mulus**: Navigasi melalui pustaka bookmark besar dengan mudah tanpa lag.

### 🪟 Manajemen Antar Jendela
- **Ikhtisar Jendela**: Lihat tab dari semua jendela Chrome yang terbuka langsung di sidebar, bukan hanya jendela saat ini.
- **Pencarian Global**: Hasil pencarian mencakup tab dari semua jendela, memungkinkan navigasi instan di seluruh sesi Anda.

### 🔍 Pencarian Tingkat Profesional
Jangan hanya mencari—temukan secara instan.
- **Pemfilteran Multi-Kata Kunci**: Mendukung kata kunci yang dipisahkan spasi (misalnya, "google docs kerja") untuk penargetan yang tepat.
- **Pencarian Domain**: Ketik domain (seperti `github.com`) untuk memfilter tab dan bookmark dari sumber tertentu secara instan.
- **Penyorotan Cerdas**: Penyorotan kata kunci yang cocok secara real-time menjaga fokus visual Anda tetap jelas.

### 🗂️ Ruang Kerja Terpadu
- **Tab Vertikal**: Lihat judul halaman lengkap tanpa kompresi.
- **Dukungan Grup Asli**: Terintegrasi sempurna dengan Grup Tab Chrome.
- **Penamaan Jendela Kustom**: Berikan nama khusus pada jendela Anda (misalnya, "Kerja", "Pribadi") untuk konteks yang lebih jelas.
- **Seret & Lepas**: Manajemen intuitif—pindahkan item dengan mudah antara tab, grup, dan folder bookmark.
- **Seret untuk Menyimpan**: Seret tab ke area bookmark untuk menyimpannya secara instan; seret bookmark ke area tab untuk membukanya.

### 🎨 Desain Premium
- **Mode Fokus**: Tema gelap yang apik dengan kontras yang disesuaikan secara cermat untuk mengurangi ketegangan mata.
- **Perluas Otomatis**: Arahkan kursor ke folder saat menyeret item untuk memperluas jalur secara otomatis.
- **Smart Hover**: Tombol tindakan hanya muncul saat dibutuhkan, menjaga antarmuka tetap bersih dan bebas gangguan.

## ⌨️ Navigasi Keyboard Lengkap
- **Pengalaman Asli**: Gunakan tombol `Panah Atas`/`Panah Bawah` untuk menavigasi secara mulus antara tab dan bookmark.
- **Mikro-Interaksi**: Gunakan `Panah Kiri`/`Panah Kanan` untuk menavigasi dan memicu tombol internal (seperti Tutup, Tambahkan ke Grup).
- **Integrasi Pencarian**: Tekan `Atas` di bagian atas daftar untuk memfokuskan bilah pencarian; tekan `Bawah` di bilah pencarian untuk melompat ke hasil.
- **Tip Fokus**: Setelah sidebar terbuka, cukup tekan tombol panah apa pun untuk secara otomatis mengambil fokus dan mulai menavigasi.

### ⌨️ Pintasan Produktivitas
- **Cmd/Ctrl + I**: Beralih Sidebar
- **Opt/Alt + T**: Buat tab baru di samping tab saat ini

---

## 🆚 Mengapa Memilih Ekstensi Ini?

| Fitur | Ekstensi Ini | Chrome Asli | Sidebar Tradisional |
| :--- | :---: | :---: | :---: |
| **Tab Vertikal** | ✅ Judul Lengkap | ❌ Terkompresi | ✅ |
| **Grup Tab** | ✅ Sinkronisasi Asli | ✅ | ⚠️ Parsial |
| **Integrasi Bookmark** | ✅ Panel Terpadu | ❌ Manajer Terpisah | ❌ Terpisah |
| **Tab Terkait** | ✅ Sinkronisasi Status| ❌ | ❌ |
| **Pencarian Antar Jendela** | ✅ | ❌ | ⚠️ Bervariasi |
| **Performa** | ⚡️ Rendering Dinamis | N/A | 🐢 Virtual Scroll |

---

## 🚀 Instalasi & Pengembangan

### Opsi 1: Instal dari Chrome Web Store (Direkomendasikan)

Anda dapat menginstal ekstensi langsung dari toko resmi untuk menerima pembaruan otomatis:

[**Klik di sini untuk menginstal dari Chrome Web Store**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Opsi 2: Instalasi Manual dari Sumber (untuk Pengembang)

**1. Prasyarat**

Sebelum memulai, pastikan Anda telah menginstal [Node.js](https://nodejs.org/) (termasuk npm) di sistem Anda.

**2. Langkah Penyiapan**

1.  Kloning atau unduh proyek ini ke mesin lokal Anda.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Navigasikan ke direktori proyek dan instal dependensi pengembangan yang diperlukan:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Buka browser Chrome dan navigasikan ke `chrome://extensions`.
4.  Aktifkan "Developer mode" di sudut kanan atas.
5.  Klik "Load unpacked" dan pilih direktori root proyek.

---

## 🛠️ Perintah Build

Proyek ini menggunakan `Makefile` untuk mengotomatiskan proses build.

*   **Mode Pengembangan**: `make` atau `make package`

    Perintah ini membuat build pengembangan yang tidak diminifikasi (unminified). Semua kode sumber tetap apa adanya, sehingga mudah di-debug di alat pengembang Chrome. File yang dipaketkan akan berupa `arc-sidebar-v<version>-dev.zip`.

*   **Mode Produksi**: `make release`

    Perintah ini menjalankan proses build produksi, yang mencakup langkah-langkah berikut:
    1.  Membundel dan meminifikasi semua modul JavaScript ke dalam satu file menggunakan `esbuild`.
    2.  Meminifikasi file CSS.
    3.  Memasukkan output ke dalam file `.zip` yang sesuai untuk diunggah ke Chrome Web Store.

---

## 🧪 Pengujian

Untuk memastikan kualitas dan stabilitas fitur proyek, kami mengadopsi pendekatan pengujian use case untuk memvalidasi setiap perubahan.

### Pengujian Use Case

*   **Tujuan**: Setiap pengujian use case mendefinisikan dengan jelas perilaku yang diharapkan dan alur operasional dari fitur tertentu. Pengujian ini disajikan dalam teks deskriptif, merinci langkah-langkah pengujian, prasyarat, hasil yang diharapkan, dan metode verifikasi.
*   **Lokasi**: Semua file pengujian use case disimpan dalam folder `usecase_tests/` di root proyek.
*   **Eksekusi & Verifikasi**: Pengujian ini saat ini dilakukan secara manual. Pengembang perlu mensimulasikan operasi pengguna di ekstensi Chrome yang sedang berjalan sesuai dengan langkah-langkah dalam file pengujian dan mengamati apakah hasilnya memenuhi harapan.

### Pengujian Otomatis

Untuk pengujian otomatis di masa mendatang, kami telah memilih **Puppeteer** sebagai kerangka pengujian End-to-End (E2E) kami. Ini memungkinkan kita menulis skrip untuk mensimulasikan berbagai tindakan pengguna di browser dan memverifikasi fungsionalitas.

---

## 🔒 Privasi & FAQ

Kami menghargai privasi Anda. Ekstensi ini beroperasi sepenuhnya secara lokal dan tidak mengumpulkan atau mengirimkan data pribadi Anda.

Untuk detail lebih lanjut, silakan lihat [Kebijakan Privasi](../../PRIVACY_POLICY.md) kami.

---

## 👥 Kontributor

Terima kasih khusus kepada semua kontributor yang membantu membuat proyek ini lebih baik:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT - lihat file [LICENSE](../../LICENSE) untuk detailnya.
