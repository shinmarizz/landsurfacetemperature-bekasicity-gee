# WebGIS Analisis Land Surface Temperature (LST) Kota Bekasi

## Link Akses
[WebGIS LST Kota Bekasi](https://windy-nation-484911-g8.projects.earthengine.app/view/webgislstbekasi)

Peta interaktif berbasis Google Earth Engine (GEE) untuk memantau dan menganalisis tren **Land Surface Temperature (LST)** Kota Bekasi periode **2015–2025**, dilengkapi visual True Color, grafik tren, statistik per tahun, dan informasi titik interaktif.

Disusun oleh **Adnan Yusuf Hartawan**, Teknik Geodesi, Universitas Diponegoro.

---

## Ringkasan Proyek

Proyek ini membangun aplikasi peta interaktif (GEE App/Script) untuk:
- Memvisualisasikan citra satelit True Color dan LST Kota Bekasi dari tahun ke tahun.
- Menghitung dan menampilkan statistik LST (min, maks, rata-rata) tahunan.
- Menampilkan tren LST 2015–2025 dalam bentuk grafik time series.
- Memungkinkan eksplorasi nilai reflektansi & suhu permukaan pada titik lokasi tertentu secara langsung di peta.

---

## Sumber Data

| Data | Sumber | Kegunaan |
|---|---|---|
| Landsat 8 Collection 2 Level-2 (SR/ST) | `LANDSAT/LC08/C02/T1_L2` (USGS) | True Color & perhitungan LST |
| Sentinel-2 Surface Reflectance Harmonized | `COPERNICUS/S2_SR_HARMONIZED` | True Color pembanding tahun 2024 |
| Batas Administrasi Kota Bekasi | `FAO/GAUL/2015/level2` | Wilayah studi (clip/crop) |

---

## Metodologi

1. **Batas wilayah studi**
   Batas administrasi Kota Bekasi diambil dari dataset **FAO GAUL 2015 Level 2**, difilter berdasarkan `ADM1_NAME = 'Jawa Barat'` dan `ADM2_NAME = 'Kota Bekasi'`. Seluruh proses filter citra, clipping, dan perhitungan statistik menggunakan batas ini sebagai `geometry`.

   > ⚠️ FAO GAUL tidak selalu konsisten membedakan prefix "Kota"/"Kabupaten". Skrip menyertakan langkah verifikasi (`print`) untuk mengecek penamaan sebelum filter final digunakan.

2. **Pra-pemrosesan citra Landsat 8 SR**
   - Filter citra berdasarkan `CLOUD_COVER < 20%`.
   - Masking awan, bayangan awan, dan cirrus menggunakan band `QA_PIXEL`.
   - Penerapan *scale factor* resmi USGS pada band reflektansi (`SR_B*`) dan band termal (`ST_B10`), karena Collection 2 Level-2 disimpan dalam bentuk integer.
   - Komposit **median** dibentuk per tahun untuk mengurangi noise dan gangguan awan residual.

3. **Perhitungan LST**
   LST dihitung langsung dari band **`ST_B10`** (produk *Surface Temperature* resmi USGS), yang sudah terkoreksi:
   - Emisivitas permukaan (menggunakan data ASTER GED),
   - Efek atmosfer.

   Formula konversi ke Celsius:
   ```
   LST (°C) = (ST_B10 × 0.00341802 + 149.0) − 273.15
   ```

   Pendekatan ini dipilih untuk menggantikan metode manual (brightness temperature TOA + NDVI-emisivitas) karena lebih akurat dan sesuai rekomendasi terbaru USGS.

4. **Mode komposit musim**
   Tersedia dua mode komposit untuk mengakomodasi variasi musim tropis:
   - **Tahun Penuh (Jan–Des)** — representasi rata-rata kondisi sepanjang tahun.
   - **Musim Kemarau (Jun–Sep)** — mengurangi pengaruh variasi musim hujan/kemarau agar perbandingan antar-tahun lebih konsisten (apple-to-apple).

5. **Kontrol kualitas data**
   Skrip mencetak **jumlah citra valid per tahun** (Jan-Des maupun Jun-Sep) ke Console sebagai indikator keandalan komposit — komposit dari sedikit citra (mis. 1–2 scene) lebih rentan noise dan kurang representatif dibanding komposit dari banyak citra.

---

## Fitur Aplikasi

- **Panel Kontrol** (kiri atas): toggle layer Sentinel-2, True Color, LST, mode komposit musim, dan slider pemilihan tahun (2015–2025).
- **Legenda LST** (kiri bawah): skala warna suhu permukaan (20–40 °C).
- **Panel Informasi** (kanan atas): deskripsi proyek, metodologi, sumber data, dan statistik LST tahun aktif (min, maks, rata-rata).
- **Grafik Tren** (Console): time series LST Kota Bekasi 2015–2025.
- **Info Titik Interaktif** (klik di peta, kanan bawah): menampilkan LST dan reflektansi permukaan (band SR) pada koordinat yang diklik, sesuai tahun & mode musim aktif.

---

## Keterbatasan & Catatan Penting

- **Resolusi termal**: band `ST_B10` didistribusikan pada 30 m, namun resolusi asli sensor TIRS adalah 100 m — nilai LST per piksel dapat merupakan campuran (*mixed pixel*) beberapa jenis tutupan lahan pada area urban heterogen seperti Bekasi.
- **Ketersediaan citra tidak seragam**: jumlah citra bebas awan per tahun bervariasi (lihat output Console), sehingga kualitas komposit antar-tahun tidak selalu setara.
- **Model emisivitas ST_B10** berbasis ASTER GED (kalibrasi global), belum divalidasi khusus untuk karakteristik urban tropis Indonesia.
- **Batas administrasi FAO GAUL 2015** merupakan generalisasi global; untuk kebutuhan analisis spasial presisi tinggi, disarankan memakai batas resmi (mis. BIG/Kemendagri).
- **Sentinel-2** hanya digunakan sebagai pembanding visual True Color tahun 2024, bukan bagian dari analisis tren kuantitatif LST.
- Disarankan melakukan validasi LST dengan data suhu udara in-situ (mis. BMKG) sebagai *sanity check*, serta uji korelasi LST terhadap NDVI/NDBI untuk memperkuat interpretasi urban heat island.

---

## Cara Menjalankan

1. Buka [Google Earth Engine Code Editor](https://code.earthengine.google.com/).
2. Salin isi skrip (`webgis_lst_bekasi_SR.js`) ke editor.
3. Jalankan (klik **Run**).
4. Cek Console untuk:
   - Verifikasi penamaan wilayah "Bekasi" di FAO GAUL.
   - Jumlah citra valid per tahun.
   - Grafik tren LST.
5. Gunakan panel kontrol di peta untuk memilih tahun, mode musim, dan layer yang ditampilkan.
6. Klik di area manapun pada peta untuk melihat detail LST dan reflektansi di titik tersebut.

---

## Struktur File

```
webgis_lst_bekasi_SR.js   → Skrip utama Google Earth Engine
README.md                 → Dokumentasi proyek ini
```

## Visualisasi 
![Homepage](image.png)

Tampilan di atas menunjukkan layer LST tahun 2018, lengkap dengan panel kontrol layer (kiri atas), legenda gradien suhu (kiri bawah), panel informasi proyek (kanan atas), dan panel hasil klik peta yang menampilkan LST beserta nilai reflektansi TOA pada titik yang dipilih (kanan bawah).

## Keterbatasan

- Nilai LST dapat kurang akurat pada piksel yang tertutup awan meski sudah dilakukan masking, karena composite median tahunan bergantung pada ketersediaan citra bersih pada tahun tersebut.
- Formula LST yang digunakan adalah metode emisivitas-koreksi sederhana (mono-window), bukan model atmosferik penuh, sehingga cocok untuk analisis komparatif antar-tahun namun memiliki margin kesalahan absolut.
- Perhitungan pada beberapa tahun dengan citra Landsat 8 terbatas (misalnya karena tutupan awan tinggi sepanjang tahun) dapat menghasilkan data yang lebih jarang/kosong pada sebagian wilayah.

## Konteks akademik

Disusun sebagai bagian studi Teknik Geodesi, Universitas Diponegoro, dalam kajian pemantauan suhu permukaan perkotaan menggunakan data penginderaan jauh dan platform cloud computing Google Earth Engine.

Daftar pustaka

Cardille, J. A., Crowley, M. A., Saah, D., & Clinton, N. E. (Eds.). (2024). Cloud-based remote sensing with Google Earth Engine: Fundamentals and applications. Springer.

Huda, M. N., Rizqullah, R. S., Chairil, A., Pratiwi, D. A., Amatullah, A., Pure, I., Aji, M. P., & Irawan, L. Y. (2026). Analisis distribusi Land Surface Temperature (LST) tahun 2025 menggunakan Google Earth Engine di Kabupaten Jepara. JATI (Jurnal Mahasiswa Teknik Informatika), 10(3), 5391.

Wu, Q. (2020). geemap: A Python package for interactive mapping with Google Earth Engine. Journal of Open Source Software, 5(51), 2305. https://doi.org/10.21105/joss.02305
