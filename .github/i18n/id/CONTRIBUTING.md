# Panduan Kontribusi

🎉 Pertama-tama, terima kasih telah meluangkan waktu untuk berkontribusi!

Kami berdedikasi untuk membangun komunitas sumber terbuka yang **berbarrier rendah** dan **ramah AI**. Kami sangat menyarankan penggunaan alat AI (terutama **Antigravity IDE**) untuk membantu pengembangan. Bahkan jika Anda seorang pemula dalam pemrograman atau tidak terbiasa dengan bidang ini, selama Anda memiliki ide, Anda dipersilakan untuk berkontribusi melalui proses standar kami.

Dokumen ini akan memandu Anda tentang cara mengubah "keinginan yang samar" menjadi "fitur yang dapat digunakan".

## 🚀 Filosofi Inti

1.  **AI-Native Development**: Kami merangkul AI. Jangan takut membiarkan AI membantu Anda menulis kode, dokumentasi, atau menjelaskan arsitektur.
2.  **Spec-Driven Development (SDD)**: Berpikir sebelum bertindak. Spesifikasi dulu, kode kemudian. (`No Spec, No Code`)
3.  **Gesekan Rendah**: Penggunaan alat otomatis dan SOP yang jelas untuk menurunkan hambatan kontribusi.

## 🛠 Alat

*   **IDE**: Sangat disarankan menggunakan **Antigravity IDE** (editor yang disempurnakan AI).
*   **Kontrol Versi**: Git & GitHub CLI (`gh`).
*   **Runtime**: Node.js & npm.

## 🛤 SOP Pengembang: Dari Ide ke Implementasi

Kami mengadopsi proses **Spec-Driven Development (SDD)** standar untuk membantu Anda menyelesaikan pengembangan langkah demi langkah.

### Fase 1: Ide & Masalah (Idea & Issue)

Semuanya dimulai dengan sebuah ide.

1.  **Periksa Masalah yang Ada**: Lihat apakah seseorang telah mengusulkan ide serupa.
2.  **Buat Masalah (Issue)**:
    *   Untuk fitur baru, gunakan templat **Feature Request**.
    *   Untuk perbaikan bug, gunakan templat **Bug Report**.
    *   *Tip: Meskipun idenya samar, tidak apa-apa untuk membuka Issue untuk diskusi.*

### Fase 2: Analisis & Spesifikasi (Analysis & Spec)

Setelah Issue dikonfirmasi, kita masuk ke proses SDD. Ini adalah waktu terbaik untuk mendapatkan Pengetahuan Domain (Domain Knowledge).

1.  **Mulai Alur Kerja SDD**:
    Di akar proyek, Anda dapat meminta Agen AI:
    > "Saya ingin mulai mengembangkan Issue #123, tolong jalankan /sdd-process untuk saya"
    *   AI akan membuat direktori standar: `/docs/specs/{type}/ISSUE-123_{desc}/`.

2.  **Susu PRD (Product Requirement Document)**:
    *   AI akan membantu Anda membuat `/docs/specs/.../PRD_spec.md`.
    *   Anda perlu menentukan: **Apa yang harus dilakukan (User Stories)** dan **Kriteria Penerimaan (Acceptance Criteria)**.
    *   *Tip: Gunakan AI untuk membantu Anda menyempurnakan User Story dan kasus tepi.*

3.  **Susu SA (System Analysis)**:
    *   Setelah PRD disetujui, AI membantu membuat `/docs/specs/.../SA_spec.md`.
    *   Anda perlu menentukan: **Arsitektur Teknis**, **API**, **Aliran Data**.
    *   **Traceability**: Pastikan setiap keputusan desain dipetakan kembali ke persyaratan PRD.

### Fase 3: Implementasi

Setelah spesifikasi selesai, saatnya melakukan Coding dengan gembira.

1.  **Pemeriksaan Pra-Kode (Pre-Code Check)**:
    *   Konfirmasikan bahwa status PRD dan SA adalah **Approved**.

2.  **Biarkan AI Menulis Kode**:
    *   Berikan `PRD_spec.md` dan `SA_spec.md` ke Antigravity/AI.
    *   Contoh prompt: *"Tolong terapkan fitur rendering jendela lain sesuai dengan Tugas 1 di SA_spec.md."*

3.  **Dokumentasi Hidup (Living Documentation)**:
    *   ⚠️ **Penting**: Jika Anda menemukan bahwa desain memerlukan modifikasi selama implementasi, **segera perbarui SA/PRD**.
    *   Jaga agar spesifikasi dan kode selalu sinkron.

### Fase 4: Verifikasi & PR

1.  **Tinjauan Mandiri**:
    *   Jalankan `npm test` untuk memastikan pengujian lulus.
    *   Periksa **Kriteria Penerimaan (Acceptance Criteria)** di `PRD_spec.md` satu per satu.

2.  **Buka Pull Request**:
    *   Gunakan CLI `gh` untuk membuat PR (Disarankan) atau melalui antarmuka web.
    *   Jika menggunakan Antigravity, Anda dapat menggunakan alur kerja `/create-pr` secara langsung.
    *   Jalankan skrip verifikasi:
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   Pastikan deskripsi PR lengkap dan menyertakan konteks bilingual (AI dapat membantu menerjemahkan).
    *   **Laporan**: Laporkan hasil verifikasi (Lulus/Gagal) di Deskripsi PR.

## 📝 Panduan Gaya

*   **Pesan Commit**: Ikuti Conventional Commits (`feat`, `fix`, `docs`, `refactor`...).
    *   Anda dapat menggunakan keahlian `commit-message-helper` dalam proyek ini.
*   **Bahasa**: Dokumentasi dan komunikasi proyek dapat menggunakan bahasa asli Anda, tetapi komentar kode dan variabel harus menggunakan bahasa Inggris.
*   **Gaya Kode**: Jaga konsistensi, mengacu pada gaya kode yang ada.

## 🤝 Mencari Bantuan

*   Jika Anda buntu, silakan tinggalkan komentar di Issue.
*   Jangan ragu untuk bertanya pada AI: "Apa arti potongan kode ini?" atau "Bagaimana saya harus menguji fitur ini?".

Kami menunggu kontribusi Anda! Mari membangun perangkat lunak yang lebih baik bersama AI.
