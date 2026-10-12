# Chrome Extension Colosal — Desain

Tanggal: 2026-10-12

## Tujuan

Extension Chrome (side panel) untuk pengguna Colosal yang bekerja di Upwork:

1. **Create proposal** — di halaman job Upwork, generate cover letter, jawaban pertanyaan, dan confidence level untuk apply, memakai template milik user.
2. **Optimize profile** — di halaman profil Upwork milik user, scan profil, tampilkan laporan kelebihan/kekurangan, lalu saran perbaikan tertulis.

Kriteria sukses: user yang sudah login di Colosal dapat membuka side panel di halaman job/profil Upwork dan mendapat hasil tanpa login ulang.

## Di luar scope v1

- Isi otomatis form Upwork (hanya saran tertulis + tombol Copy).
- Menyimpan hasil ke database.
- Rilis ke Chrome Web Store.
- Attachment pada proposal.

## Keputusan

| Topik | Keputusan |
|---|---|
| Tooling | WXT + React + TypeScript, folder `extension/` di repo ini |
| UI | Chrome side panel |
| Login | Memakai cookie sesi Supabase yang sudah ada; extension memanggil API Colosal dengan `credentials: "include"` |
| Sumber data job | Scrape DOM halaman Upwork yang sedang dibuka |
| Pilihan template | Dropdown **template** (`proposal_templates`), bukan scan config |
| Jawaban pertanyaan | Bahan dari `user_profiles` (summary, current_role, previous_experience, skills_text, portfolio, key_proof_points, positioning_notes). `question_instruction` / `question_answer_base` milik scan config tidak dipakai |
| Output optimize profile | Saran tertulis + Copy |
| Bahasa UI | Inggris (sama dengan web app), termasuk pesan error API dan teks hasil AI |

## Backend

### Perubahan `proxy.ts`

Semua path non-publik tanpa sesi di-redirect 307 ke `/login`, termasuk preflight `OPTIONS`. Tambahkan `/api/ext` ke `publicPaths`. Auth dicek di tiap route lewat `supabase.auth.getUser()` dan mengembalikan `401` JSON.

### CORS — `lib/ext-cors.ts`

- Mengizinkan origin `chrome-extension://<ID>` dari env `EXTENSION_ORIGIN` dengan `Access-Control-Allow-Credentials: true`. Origin lain tidak mendapat header CORS.
- Handler `OPTIONS` untuk preflight.
- ID extension dipinned dengan `key` di manifest agar `EXTENSION_ORIGIN` stabil di semua mesin.

### Klien LLM — `lib/ai/sumopod.ts`

Ekstrak pemanggilan SUMOPOD (`gpt-4o-mini`, `response_format: json_object`) dari `generate-proposal` agar dipakai tiga route. Route `generate-proposal` yang ada tidak diubah.

Teks dari luar (deskripsi job, data profil) dimasukkan ke prompt sebagai data dengan delimiter, dengan instruksi mengabaikan perintah di dalamnya.

### Endpoint — `app/api/ext/`

- `GET /templates` → `[{id, name}]` template milik user.
- `POST /proposal`
  - Input: `{job: {title, description, questions[], skills[], budget?, experienceLevel?, projectType?, englishLevel?, connectsCost?, activity?: {proposals, interviewing, invitesSent}, client?: {paymentVerified, country, jobsPosted, hireRate, memberSince}}, templateId}`
  - Output: `{coverLetter, questionAnswers[{question, answer}], confidence: {score 0-100, factors[{name, rating, note}]}}`
  - Confidence memakai rubrik tetap: kecocokan skill dan experience level dengan profil user, budget, kualitas klien (payment verified, hire rate, riwayat job), persaingan (jumlah proposal, interviewing), dan biaya Connects. Field yang tidak berhasil di-scrape ditandai "tidak diketahui" dan tidak dihitung.
  - `questions` kosong menghasilkan `questionAnswers` kosong.
- `POST /profile`
  - Input: tanpa body. Server membaca profil user sendiri dari Upwork GraphQL API (`talentProfile`: title, description, employmentRecords, projectList, skills) dengan token OAuth yang sudah tersimpan di `user_profiles`, memakai query yang sama dengan `app/api/upwork/profile/route.ts` (diekstrak ke `lib/upwork/talent-profile.ts`). Tidak ada scraping halaman profil, dan profil yang dianalisis pasti milik user. Syarat: akun Upwork sudah terhubung (jika tidak, `400`). Keterbatasan: GraphQL tidak memuat hourly rate, job success score, atau sertifikasi.
  - Output: `{report: {strengths[], weaknesses[]}, suggestions: {headline, overview, skills[]}}`

Semua endpoint: header `Origin` harus sama dengan `EXTENSION_ORIGIN` (selain itu `403`), lalu cek sesi (`401` JSON).

Plan gating: gating yang ada (`user_subscriptions`: `plan`, `status`) hanya membatasi scanner dan WhatsApp. Untuk extension, endpoint LLM (`/proposal`, `/profile`) dibatasi per user per 24 jam lewat tabel baru `ext_usage` (RLS: select/insert milik sendiri): free 10, paid 100 (`paid` = plan `paid` dan status bukan `cancelled`). Angka ini keputusan produk dalam satu konstanta di `lib/ext-auth.ts`. Melebihi batas mengembalikan `429`.

## Extension

```
extension/
  wxt.config.ts          # manifest: host_permissions (Upwork + domain Colosal), key, sidePanel
  entrypoints/
    background.ts        # hanya membuka side panel saat ikon diklik
    sidepanel/           # React: login gate, tab Proposal, tab Profile
  lib/
    api.ts               # klien API Colosal, mengembalikan {status: "unauth"} saat 401
    page.ts              # baca teks tab aktif via chrome.scripting.executeScript
    parse-job.ts         # parser teks halaman job (berbasis label, bukan class CSS)
    types.ts             # JobData, hasil proposal/profile
```

Tidak ada content script: side panel membaca teks tab aktif saat tombol diklik (`chrome.scripting.executeScript`, permission `scripting` + host permission Upwork). Ini menghilangkan pesan antar-komponen dan pelacakan perubahan URL SPA.

Side panel memanggil API langsung (extension page dengan `host_permissions`), tanpa proxy lewat background worker, karena worker MV3 dapat dimatikan di tengah request panjang.

### Scraping

- Side panel membaca halaman yang sedang aktif saat aksi dijalankan (bukan saat panel dibuka), sehingga navigasi SPA Upwork tidak perlu dilacak.
- Tidak ada deteksi tipe halaman dari URL. Kedua tab selalu tampil; validasi dilakukan pada hasil baca: bukan tab Upwork atau halaman bukan job/profil menghasilkan pesan error jelas dan tidak ada request ke API.
- Parser job memakai teks halaman (`document.body.innerText`) yang diurai berdasarkan label yang terlihat ("Skills and Expertise", "About the client", dst), bukan class CSS. Field wajib kosong (judul/deskripsi job) menghasilkan error eksplisit, bukan data parsial.
- Pertanyaan screening tampil di halaman job detail (blok "You will be asked to answer the following questions when submitting a proposal", daftar bernomor). Scraper cukup di halaman job detail; jika blok tidak ada, `questions` dikosongkan.
- Field job yang tersedia di halaman job detail (dari halaman asli): judul, waktu posting, lokasi, deskripsi, budget (fixed-price atau hourly), experience level, project type, pertanyaan screening, skills, English level, aktivitas (proposals, last viewed by client, interviewing, invites sent, unanswered invites), biaya Connects, dan info klien (payment verified, phone verified, negara, jumlah job diposting, hire rate, member since). Bid range hanya tampil untuk membership berbayar, jadi tidak diandalkan.
- Tab Profil tidak membaca halaman Upwork sama sekali; tombol Start scan bisa dipakai dari tab mana pun.

### Alur UI

- **Login gate:** saat dibuka, panel memanggil `GET /templates`. Jika `401`, tampil tombol "Login ke Colosal" yang membuka tab `/login`; panel mengecek ulang saat tab kembali aktif.
- **Tab Proposal:** pilih template → Generate → tiga kartu hasil (cover letter, jawaban pertanyaan, confidence dengan faktor-faktornya), masing-masing dengan Copy.
- **Tab Profil:** "Start scan" → laporan kelebihan/kekurangan → "Optimize now" → saran headline, overview, skills dengan Copy.
- Setiap aksi punya state loading dan pesan error berbahasa Indonesia dengan tombol coba lagi. Generate dapat memakan hingga 60 detik.

## Cookie dan CORS — risiko yang harus diverifikasi

Cookie Supabase berstatus `SameSite=Lax`. Chrome seharusnya tetap mengirimnya untuk request dari extension page ber-`host_permissions` ke domain Colosal, tetapi harus dites langsung. Fallback: content script di domain Colosal yang meneruskan token ke extension.

## Risiko yang diterima

- **ToS Upwork:** scraping DOM di browser user sendiri lebih ringan daripada bot, tetapi tetap area abu-abu. Tidak ada otomasi tulis ke halaman Upwork di v1.
- **DOM Upwork berubah:** scraper dapat rusak; kegagalan ditampilkan sebagai error eksplisit.
- **Confidence level** hanya sebaik data yang berhasil di-scrape.

## Pengujian

Repo tidak punya test suite. Vitest hanya di paket `extension/`, untuk parser job (fixture teks halaman job asli). Backend (CORS, `401`/`403`) diverifikasi dengan `curl`. Sisanya diverifikasi manual dengan memuat extension unpacked di Chrome: login gate (dengan dan tanpa sesi), generate proposal di halaman job, scan dan optimize di halaman profil.

## Langkah pertama implementasi

1. Verifikasi cookie `SameSite=Lax` terkirim dari extension page.
2. Buka halaman job dan profil Upwork asli untuk menentukan selector.
3. Cocokkan parser job dengan teks halaman job asli (terutama baris skills dan field klien).
