# Folder `changelog/`

Tempat catatan proyek AirKas RT. Isinya tiga berkas dengan tugas berbeda:

| Berkas | Isinya | Dibaca kapan |
|---|---|---|
| [CHANGELOG.md](CHANGELOG.md) | **Apa yang sudah berubah** di aplikasi, urut dari terbaru | Saat ingin tahu "kapan ini berubah?" atau "kenapa angkanya beda dari laporan lama?" |
| [mantra-antigravity.md](mantra-antigravity.md) | **Aturan main proyek** — filosofi, larangan, prosedur | Sebelum mulai mengerjakan apa pun |
| [handoff_chatgpt_airkas.md](handoff_chatgpt_airkas.md) | **Pengenalan proyek** untuk AI atau orang baru | Saat menyerahkan pekerjaan ke pihak lain |

> **Catatan:** `mantra-antigravity.md` dan `handoff_chatgpt_airkas.md` dulu
> berada di akar proyek. Dipindah ke sini supaya semua catatan berkumpul di
> satu tempat. Isinya tidak diubah.

---

## Ritual: menambah entri changelog

Dilakukan **setelah pekerjaan selesai dan terbukti jalan**, sebelum atau
sesudah commit — bukan saat masih setengah jadi.

### Yang dicatat

Hanya yang **terasa oleh bendahara atau warga**:

- Fitur baru atau yang berubah cara pakainya
- Angka atau status yang sebelumnya salah lalu diperbaiki
- Tampilan laporan yang berubah bentuk
- Perubahan yang membuat laporan lama **tidak lagi sama** dengan yang baru

### Yang tidak perlu dicatat

- Perapian kode yang tidak mengubah apa pun di layar
- Perbaikan pengujian, lint, atau pengaturan CI *(kecuali kalau sempat
  mengganggu, seperti CI yang merah berhari-hari)*
- Pekerjaan setengah jadi yang belum dipakai

Kalau ragu: **apakah warga atau bendahara akan menyadarinya?** Kalau tidak,
lewati saja.

### Cara menulisnya

Pakai bahasa sehari-hari, bukan istilah teknis. Bandingkan:

| ❌ Jangan | ✅ Begini |
|---|---|
| "Refactor status evaluation to use getWargaBillingSummary" | "Status 'Belum Lunas' yang keliru di PDF diperbaiki — sisa saldo warga sekarang ikut dihitung" |
| "Add penggantian_meter table with RLS" | "Meteran yang rusak sekarang bisa diganti tanpa mengacaukan perhitungan" |

Sebutkan **angka nyata** bila ada — jauh lebih meyakinkan daripada kata sifat.
Misalnya *"17 dari 145 baris salah"*, bukan *"beberapa baris salah"*.

### Bentuk entrinya

```markdown
## <tanggal>

### <kelompok: Laporan / Meteran / Tampilan / Perbaikan / Perawatan>
- Kalimat pendek tentang apa yang berubah bagi pemakai.
- Kalau memperbaiki kesalahan, sebutkan **apa yang dulu salah** — supaya
  nanti jelas kenapa laporan lama berbeda dari yang baru.
```

Kelompok di atas bukan daftar baku. Pakai yang masuk akal saat itu.

---

## Kenapa ini ada

Laporan yang sudah terlanjur dibagikan ke warga **tidak ikut berubah** saat
aplikasi diperbaiki. Tanpa catatan ini, suatu hari ada yang membandingkan PDF
Agustus dengan PDF Agustus cetakan ulang, menemukan angkanya beda, dan tidak
ada yang bisa menjelaskan kenapa.

Changelog ini jawabannya.
