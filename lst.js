// ============================================================
// WebGIS LST Kota Bekasi 2015-2025
// Versi: Landsat 8 Collection 2 Level-2 (Surface Reflectance)
// LST dihitung dari band ST_B10 (Surface Temperature product resmi USGS,
// sudah terkoreksi emisivitas menggunakan ASTER GED)
// ============================================================

// -------------------- BATAS ADMINISTRASI: FAO GAUL --------------------
// Menggunakan FAO GAUL 2015 Level 2 sebagai sumber batas wilayah studi
// (menggantikan asset geometry gambar manual).
var gaulLevel2 = ee.FeatureCollection('FAO/GAUL/2015/level2');

// Langkah verifikasi (jalankan sekali, cek di Console):
// FAO GAUL sering tidak konsisten memakai prefix "Kota"/"Kabupaten",
// jadi cek dulu semua fitur yang mengandung kata "Bekasi" sebelum fix nama final.
var cekBekasi = gaulLevel2.filter(ee.Filter.stringContains('ADM2_NAME', 'Bekasi'));
print('Cek penamaan wilayah "Bekasi" di FAO GAUL:', cekBekasi);

// Ambil khusus Kota Bekasi (bukan Kabupaten Bekasi).
// Jika print di atas menunjukkan nama berbeda (mis. hanya "Bekasi" tanpa
// prefix "Kota"), sesuaikan filter ADM2_NAME di bawah ini, atau filter
// berdasarkan ADM2_CODE yang muncul pada hasil print supaya lebih pasti.
var kotaBekasi = gaulLevel2.filter(
  ee.Filter.and(
    ee.Filter.eq('ADM1_NAME', 'Jawa Barat'),
    ee.Filter.eq('ADM2_NAME', 'Kota Bekasi')
  )
);

// geometry di sini menggantikan variabel geometry manual yang dipakai
// di seluruh bagian script (filterBounds, clip, reduceRegion, dll).
var geometry = kotaBekasi.geometry();

Map.addLayer(kotaBekasi, {color: 'FF0000'}, 'Batas Kota Bekasi (FAO GAUL)', false);

// -------------------- MASKING AWAN --------------------
// Bit position sama untuk QA_PIXEL Collection 2 (TOA maupun L2/SR)
function maskL8sr(citra) {
  var qa = citra.select('QA_PIXEL');
  var cloudBitMask = 1 << 3;
  var cloudShadowBitMask = 1 << 4;
  var cirrusBitMask = 1 << 2;

  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudShadowBitMask).eq(0))
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return citra.updateMask(mask);
}

// -------------------- SCALE FACTOR SR/ST --------------------
// Wajib untuk Collection 2 Level-2: band optik (SR_B*) dan termal (ST_B10)
// disimpan dalam bentuk integer sehingga perlu dikonversi ke nilai fisik.
function applyScaleFactors(citra) {
  var opticalBands = citra.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBand = citra.select('ST_B10').multiply(0.00341802).add(149.0);
  return citra.addBands(opticalBands, null, true)
              .addBands(thermalBand, null, true);
}

function maskS2clouds(citra) {
  var qa = citra.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return citra.updateMask(mask).divide(10000);
}

var lstVis = {
  min: 20,
  max: 50,
  palette: [
    '040274','040281','0502a3','0502b8','0502ce','0502e6',
    '0602ff','235cb1','307ef3','269db1','30c8e2','32d3ef',
    '3be285','3ff38f','86e26f','3ae237','b5e22e','d6e21f',
    'fff705','ffd611','ffb613','ff8b13','ff6e08','ff500d',
    'ff0000','de0101','c21301','a71001','911003'
  ]
};

// Nama band berubah menjadi SR_B4, SR_B3, SR_B2 pada Collection 2 Level-2
var l8Vis = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0,
  max: 0.3,
  gamma: [1.1, 1.1, 1]
};

var s2Vis = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 0.3,
  gamma: 1.1
};

// -------------------- AMBIL CITRA TAHUNAN (SR) --------------------
// mode: 'penuh' = Januari-Desember, 'kemarau' = Juni-September
// Musim kemarau dipakai supaya perbandingan LST antar-tahun lebih
// apple-to-apple (tidak tercampur variasi musim hujan/kemarau).
function ambilKoleksiTahun(tahun, mode) {
  var startDate, endDate;
  if (mode === 'kemarau') {
    startDate = tahun + '-06-01';
    endDate = tahun + '-10-01';
  } else {
    startDate = tahun + '-01-01';
    endDate = tahun + '-12-31';
  }

  return ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20));
}

function ambilCitraTahun(tahun, mode) {
  return ambilKoleksiTahun(tahun, mode)
    .map(maskL8sr)
    .map(applyScaleFactors)
    .median()
    .clip(geometry);
}

// -------------------- CEK JUMLAH CITRA VALID PER TAHUN --------------------
// Median dari sedikit citra (mis. 2-3 scene) jauh lebih noisy/tidak
// representatif dibanding median dari banyak citra. Ini penting dicatat
// sebagai bagian kualitas data pada laporan/skripsi.
print('=== Jumlah citra Landsat 8 SR valid per tahun (CLOUD_COVER < 20%) ===');
var daftarTahunUntukCek = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
daftarTahunUntukCek.forEach(function(tahun) {
  var jumlahPenuh = ambilKoleksiTahun(tahun, 'penuh').size();
  var jumlahKemarau = ambilKoleksiTahun(tahun, 'kemarau').size();
  print(
    'Tahun ' + tahun + ' -> Jan-Des: ', jumlahPenuh,
    ' | Jun-Sep (kemarau): ', jumlahKemarau
  );
});

// -------------------- HITUNG LST DARI PRODUK ST_B10 --------------------
// ST_B10 pada Collection 2 Level-2 sudah berupa Surface Temperature (Kelvin)
// hasil koreksi emisivitas resmi USGS, jadi tidak perlu lagi menghitung
// NDVI -> PV -> emisivitas -> Planck secara manual seperti pada versi TOA.
function hitungLST(dataset) {
  var lstKelvin = dataset.select('ST_B10');
  var lstCelsius = lstKelvin.subtract(273.15).rename('LST_CELSIUS');
  return lstCelsius;
}

var daftarTahun = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
var tahunAktif = 2018;
var modeMusim = 'penuh'; // 'penuh' (Jan-Des) atau 'kemarau' (Jun-Sep)

// Dictionary bersarang: l8TrueColorLayers[mode][tahun]
var l8TrueColorLayers = {penuh: {}, kemarau: {}};
var lstLayers = {penuh: {}, kemarau: {}};

['penuh', 'kemarau'].forEach(function(mode) {
  daftarTahun.forEach(function(tahun) {
    var citraTahun = ambilCitraTahun(tahun, mode);
    var lstTahun = hitungLST(citraTahun);

    // Hanya tahun aktif + mode aktif yang langsung tampil di awal
    var tampilkan = (tahun === tahunAktif && mode === modeMusim);

    var labelMode = (mode === 'kemarau') ? ' [Kemarau]' : ' [Tahun Penuh]';
    var layerTrueColor = Map.addLayer(
      citraTahun, l8Vis, 'Landsat 8 SR True Color ' + tahun + labelMode, tampilkan
    );
    var layerLST = Map.addLayer(
      lstTahun, lstVis, 'LST (°C) ' + tahun + labelMode, tampilkan
    );

    l8TrueColorLayers[mode][tahun] = layerTrueColor;
    lstLayers[mode][tahun] = layerLST;
  });
});

var sentinelDataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(geometry)
  .filterDate('2024-01-01', '2024-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .map(maskS2clouds)
  .median()
  .clip(geometry);

var sentinelLayer = Map.addLayer(sentinelDataset, s2Vis, 'Sentinel-2 True Color 2024', true);

Map.centerObject(geometry, 12);

var controlPanel = ui.Panel({
  style: {
    position: 'top-left',
    padding: '10px',
    width: '240px',
    backgroundColor: 'white'
  }
});

controlPanel.add(ui.Label('Kontrol Layer', {
  fontWeight: 'bold',
  fontSize: '15px',
  margin: '0 0 8px 0'
}));

var checkboxSentinel = ui.Checkbox({
  label: 'Sentinel-2 True Color',
  value: true,
  onChange: function(checked) {
    sentinelLayer.setShown(checked);
  }
});
controlPanel.add(checkboxSentinel);

controlPanel.add(ui.Label('', {margin: '4px 0'})); // spasi

controlPanel.add(ui.Label('Landsat 8 SR per tahun', {
  fontWeight: 'bold',
  fontSize: '13px',
  margin: '6px 0 2px 0'
}));

var tampilkanTrueColor = true;
var tampilkanLST = true;

var checkboxTrueColor = ui.Checkbox({
  label: 'True Color',
  value: true,
  onChange: function(checked) {
    tampilkanTrueColor = checked;
    l8TrueColorLayers[modeMusim][yearSlider.getValue()].setShown(checked);
  }
});

var checkboxLSTLayer = ui.Checkbox({
  label: 'LST (°C)',
  value: true,
  onChange: function(checked) {
    tampilkanLST = checked;
    lstLayers[modeMusim][yearSlider.getValue()].setShown(checked);
  }
});

controlPanel.add(checkboxTrueColor);
controlPanel.add(checkboxLSTLayer);

controlPanel.add(ui.Label('', {margin: '4px 0'})); // spasi

controlPanel.add(ui.Label('Mode komposit', {
  fontWeight: 'bold',
  fontSize: '13px',
  margin: '6px 0 2px 0'
}));

var checkboxMusimKemarau = ui.Checkbox({
  label: 'Pakai musim kemarau (Jun-Sep)',
  value: false,
  onChange: function(checked) {
    var modeSebelumnya = modeMusim;
    modeMusim = checked ? 'kemarau' : 'penuh';

    var tahunTerpilih = yearSlider.getValue();

    // Matikan layer mode sebelumnya untuk tahun yang sedang aktif
    l8TrueColorLayers[modeSebelumnya][tahunTerpilih].setShown(false);
    lstLayers[modeSebelumnya][tahunTerpilih].setShown(false);

    // Nyalakan layer mode baru sesuai status checkbox True Color / LST
    l8TrueColorLayers[modeMusim][tahunTerpilih].setShown(tampilkanTrueColor);
    lstLayers[modeMusim][tahunTerpilih].setShown(tampilkanLST);

    updateStatistik(tahunTerpilih);
  }
});
controlPanel.add(checkboxMusimKemarau);

var yearLabel = ui.Label('Menampilkan tahun: ' + tahunAktif, {
  fontSize: '13px',
  margin: '8px 0 4px 0'
});
controlPanel.add(yearLabel);

var yearSlider = ui.Slider({
  min: 2015,
  max: 2025,
  value: tahunAktif,
  step: 1,
  style: {width: '210px'}
});

yearSlider.onChange(function(tahunTerpilih) {
  ['penuh', 'kemarau'].forEach(function(mode) {
    daftarTahun.forEach(function(tahun) {
      var aktif = (tahun === tahunTerpilih && mode === modeMusim);
      l8TrueColorLayers[mode][tahun].setShown(aktif && tampilkanTrueColor);
      lstLayers[mode][tahun].setShown(aktif && tampilkanLST);
    });
  });
  yearLabel.setValue('Menampilkan tahun: ' + tahunTerpilih);
  updateStatistik(tahunTerpilih);
});

controlPanel.add(yearSlider);

Map.add(controlPanel);

var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '10px 12px',
    backgroundColor: 'white'
  }
});

legend.add(ui.Label('LST (°C)', {
  fontWeight: 'bold',
  fontSize: '14px',
  margin: '0 0 6px 0'
}));

var makeGradient = function(palette) {
  var lon = ee.Image.pixelLonLat().select('longitude');
  var gradient = lon.multiply((lstVis.max - lstVis.min) / 100.0).add(lstVis.min);
  return gradient.visualize({
    min: lstVis.min,
    max: lstVis.max,
    palette: palette
  });
};

var thumb = ui.Thumbnail({
  image: makeGradient(lstVis.palette),
  params: {bbox: [0, 0, 100, 10], dimensions: '260x14'},
  style: {stretch: 'horizontal', margin: '0 0 6px 0'}
});
legend.add(thumb);

var labelPanel = ui.Panel({
  widgets: [
    ui.Label(lstVis.min.toString(), {margin: '0px 0px', fontSize: '12px'}),
    ui.Label(((lstVis.max + lstVis.min) / 2).toFixed(1),
      {margin: '0px 0px', textAlign: 'center', stretch: 'horizontal', fontSize: '12px'}),
    ui.Label(lstVis.max.toString(), {margin: '0px 0px', fontSize: '12px', textAlign: 'right'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});
legend.add(labelPanel);

legend.add(ui.Label('Sumber: Landsat 8 Collection 2 Level-2 SR (True Color & LST), Sentinel-2 (True Color)', {
  fontSize: '11px',
  color: '#5F5E5A',
  margin: '8px 0 0 0'
}));

Map.add(legend);

// -------------------- CHART TREN LST (dari ST_B10, sudah dalam °C) --------------------
var lstCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(geometry)
  .filterDate('2015-01-01', '2025-12-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 20))
  .map(maskL8sr)
  .map(function(img) {
    var lstC = img.select('ST_B10')
      .multiply(0.00341802).add(149.0)
      .subtract(273.15)
      .rename('LST_CELSIUS');
    return lstC.copyProperties(img, ['system:time_start']);
  });

var chart = ui.Chart.image.series({
  imageCollection: lstCollection,
  region: geometry,
  reducer: ee.Reducer.mean(),
  scale: 30,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'Tren LST 2015-2025 (Landsat 8 SR - ST_B10)',
  vAxis: {title: 'LST (°C)'},
  hAxis: {title: 'Tanggal'},
  lineWidth: 2,
  pointSize: 3
});

print(chart);

var infoPanel = ui.Panel({
  style: {
    position: 'top-right',
    padding: '12px 14px',
    width: '260px',
    backgroundColor: 'white'
  }
});

infoPanel.add(ui.Label('WebGIS LST Kota Bekasi', {
  fontWeight: 'bold',
  fontSize: '16px',
  margin: '0 0 6px 0'
}));

infoPanel.add(ui.Label(
  'Peta interaktif Land Surface Temperature (LST) Kota Bekasi periode 2015-2025, ' +
  'dibangun menggunakan Google Earth Engine.',
  {fontSize: '12px', color: '#5F5E5A', margin: '0 0 10px 0'}
));

infoPanel.add(ui.Label('Metodologi', {
  fontWeight: 'bold',
  fontSize: '13px',
  margin: '0 0 4px 0'
}));

infoPanel.add(ui.Label(
  '1. Citra Landsat 8 Collection 2 Level-2 (Surface Reflectance/Surface Temperature) ' +
  'difilter tutupan awan < 20%, lalu di-composite median per tahun.',
  {fontSize: '11px', margin: '0 0 4px 0'}
));

infoPanel.add(ui.Label(
  '2. Band ST_B10 merupakan produk Surface Temperature resmi USGS yang sudah ' +
  'terkoreksi emisivitas (ASTER GED) dan atmosfer.',
  {fontSize: '11px', margin: '0 0 4px 0'}
));

infoPanel.add(ui.Label(
  '3. LST (°C) diperoleh dari ST_B10 x 0.00341802 + 149.0, dikurangi 273.15.',
  {fontSize: '11px', margin: '0 0 4px 0'}
));

infoPanel.add(ui.Label(
  '4. Tersedia mode komposit Tahun Penuh (Jan-Des) atau Musim Kemarau (Jun-Sep) ' +
  'agar perbandingan antar-tahun tidak tercampur variasi musim hujan.',
  {fontSize: '11px', margin: '0 0 4px 0'}
));

infoPanel.add(ui.Label(
  '5. Jumlah citra valid per tahun (cek kualitas komposit) dapat dilihat ' +
  'pada Console setelah script dijalankan.',
  {fontSize: '11px', margin: '0 0 10px 0'}
));

infoPanel.add(ui.Label('Sumber data', {
  fontWeight: 'bold',
  fontSize: '13px',
  margin: '0 0 4px 0'
}));

infoPanel.add(ui.Label(
  '• Landsat 8 Collection 2 Level-2 (SR True Color & ST_B10 LST)',
  {fontSize: '11px', margin: '0 0 2px 0'}
));

infoPanel.add(ui.Label(
  '• Sentinel-2 Surface Reflectance Harmonized (True Color)',
  {fontSize: '11px', margin: '0 0 10px 0'}
));

infoPanel.add(ui.Label('Statistik LST', {
  fontWeight: 'bold',
  fontSize: '13px',
  margin: '0 0 4px 0'
}));

var statLabel = ui.Label('Memuat statistik...', {
  fontSize: '11px',
  margin: '0 0 10px 0',
  whiteSpace: 'pre'
});
infoPanel.add(statLabel);

function updateStatistik(tahun) {
  statLabel.setValue('Menghitung statistik tahun ' + tahun + '...');

  var lstTahunIni = lstLayers[modeMusim][tahun].getEeObject();

  lstTahunIni.reduceRegion({
    reducer: ee.Reducer.minMax().combine({
      reducer2: ee.Reducer.mean(),
      sharedInputs: true
    }),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  }).evaluate(function(hasil) {
    var labelMode = (modeMusim === 'kemarau') ? 'Musim Kemarau (Jun-Sep)' : 'Tahun Penuh (Jan-Des)';
    var teks =
      'Tahun: ' + tahun + ' (' + labelMode + ')\n' +
      'Min: ' + hasil.LST_CELSIUS_min.toFixed(1) + ' °C\n' +
      'Maks: ' + hasil.LST_CELSIUS_max.toFixed(1) + ' °C\n' +
      'Rata-rata: ' + hasil.LST_CELSIUS_mean.toFixed(1) + ' °C';
    statLabel.setValue(teks);
  });
}

updateStatistik(tahunAktif);

infoPanel.add(ui.Label(
  'Disusun oleh Adnan Yusuf Hartawan, Teknik Geodesi Universitas Diponegoro.',
  {fontSize: '10px', color: '#888780', margin: '4px 0 0 0'}
));

Map.add(infoPanel);

var clickInfoPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '10px 12px',
    width: '260px',
    backgroundColor: 'white',
    shown: false 
  }
});

var clickTitle = ui.Label('Informasi titik', {
  fontWeight: 'bold',
  fontSize: '14px',
  margin: '0 0 6px 0'
});

var clickCoordLabel = ui.Label('', {fontSize: '11px', color: '#5F5E5A', margin: '0 0 8px 0'});
var clickContentLabel = ui.Label('', {fontSize: '12px', whiteSpace: 'pre', margin: '0'});

var btnTutupPanel = ui.Button({
  label: 'Tutup',
  style: {margin: '8px 0 0 0'},
  onClick: function() {
    clickInfoPanel.style().set('shown', false);
  }
});

clickInfoPanel.add(clickTitle);
clickInfoPanel.add(clickCoordLabel);
clickInfoPanel.add(clickContentLabel);
clickInfoPanel.add(btnTutupPanel);

Map.add(clickInfoPanel);

Map.onClick(function(coords) {
  var titik = ee.Geometry.Point([coords.lon, coords.lat]);
  var tahunTerpilih = yearSlider.getValue();

  clickInfoPanel.style().set('shown', true);
  clickCoordLabel.setValue(
    'Lat: ' + coords.lat.toFixed(5) + ', Lon: ' + coords.lon.toFixed(5)
  );
  clickContentLabel.setValue('Mengambil data...');

  var citraTahunIni = l8TrueColorLayers[modeMusim][tahunTerpilih].getEeObject();
  var lstTahunIni = lstLayers[modeMusim][tahunTerpilih].getEeObject();

  // Nama band SR pada Collection 2 Level-2
  var citraGabungan = citraTahunIni.select(['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'])
    .addBands(lstTahunIni);

  citraGabungan.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: titik,
    scale: 30,
    maxPixels: 1e9
  }).evaluate(function(hasil) {
    if (hasil === null || hasil.LST_CELSIUS === null) {
      clickContentLabel.setValue(
        'Tahun: ' + tahunTerpilih + '\n' +
        'Tidak ada data pada titik ini\n' +
        '(kemungkinan tertutup awan/mask)'
      );
      return;
    }

    var labelModeKlik = (modeMusim === 'kemarau') ? 'Musim Kemarau (Jun-Sep)' : 'Tahun Penuh (Jan-Des)';
    var teks =
      'Tahun: ' + tahunTerpilih + ' (' + labelModeKlik + ')\n\n' +
      'LST: ' + hasil.LST_CELSIUS.toFixed(2) + ' °C\n\n' +
      'Reflektansi Permukaan (SR):\n' +
      '  B2 (Biru): ' + hasil.SR_B2.toFixed(4) + '\n' +
      '  B3 (Hijau): ' + hasil.SR_B3.toFixed(4) + '\n' +
      '  B4 (Merah): ' + hasil.SR_B4.toFixed(4) + '\n' +
      '  B5 (NIR): ' + hasil.SR_B5.toFixed(4) + '\n' +
      '  B6 (SWIR 1): ' + hasil.SR_B6.toFixed(4) + '\n' +
      '  B7 (SWIR 2): ' + hasil.SR_B7.toFixed(4);

    clickContentLabel.setValue(teks);
  });
});