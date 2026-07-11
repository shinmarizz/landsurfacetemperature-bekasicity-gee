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
  max: 40,
  palette: [
    '040274','040281','0502a3','0502b8','0502ce','0502e6',
    '0602ff','235cb1','307ef3','269db1','30c8e2','32d3ef',
    '3be285','3ff38f','86e26f','3ae237','b5e22e','d6e21f',
    'fff705','ffd611','ffb613','ff8b13','ff6e08','ff500d',
    'ff0000','de0101','c21301','a71001','911003'
  ]
};

var l8Vis = {
  bands: ['B4', 'B3', 'B2'],
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

function ambilCitraTahun(tahun) {
  var startDate = tahun + '-01-01';
  var endDate = tahun + '-12-31';

  return ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUD_COVER', 20))
    .map(maskL8sr)
    .median()
    .clip(geometry);
}

function hitungLST(dataset) {
  var ndvi = dataset.normalizedDifference(['B5', 'B4']).rename('NDVI');

  var ndviMin = ee.Number(ndvi.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  }).values().get(0));

  var ndviMax = ee.Number(ndvi.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  }).values().get(0));

  var pv = ndvi.subtract(ndviMin)
    .divide(ndviMax.subtract(ndviMin))
    .pow(2)
    .rename('PV');

  var emissivity = pv.multiply(0.004).add(0.986).rename('EMISSIVITY');

  var brightnessTemp = dataset.select('B10').rename('BT_KELVIN');

  var lst = brightnessTemp.expression(
    '(BT / (1 + (0.00115 * (BT / 1.4388)) * log(e))) - 273.15', {
      'BT': brightnessTemp,
      'e': emissivity
    }).rename('LST_CELSIUS');

  return lst;
}

var daftarTahun = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
var tahunAktif = 2018;

var l8TrueColorLayers = {};
var lstLayers = {};

daftarTahun.forEach(function(tahun) {
  var citraTahun = ambilCitraTahun(tahun);
  var lstTahun = hitungLST(citraTahun);

  var tampilkan = (tahun === tahunAktif); // hanya tahun aktif yang langsung tampil

  var layerTrueColor = Map.addLayer(citraTahun, l8Vis, 'Landsat 8 True Color ' + tahun, tampilkan);
  var layerLST = Map.addLayer(lstTahun, lstVis, 'LST (°C) ' + tahun, tampilkan);

  l8TrueColorLayers[tahun] = layerTrueColor;
  lstLayers[tahun] = layerLST;
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

controlPanel.add(ui.Label('Landsat 8 per tahun', {
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
    l8TrueColorLayers[yearSlider.getValue()].setShown(checked);
  }
});

var checkboxLSTLayer = ui.Checkbox({
  label: 'LST (°C)',
  value: true,
  onChange: function(checked) {
    tampilkanLST = checked;
    lstLayers[yearSlider.getValue()].setShown(checked);
  }
});

controlPanel.add(checkboxTrueColor);
controlPanel.add(checkboxLSTLayer);

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
  daftarTahun.forEach(function(tahun) {
    var aktif = (tahun === tahunTerpilih);
    l8TrueColorLayers[tahun].setShown(aktif && tampilkanTrueColor);
    lstLayers[tahun].setShown(aktif && tampilkanLST);
  });
  yearLabel.setValue('Menampilkan tahun: ' + tahunTerpilih);
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

legend.add(ui.Label('Sumber: Landsat 8 (True Color & LST), Sentinel-2 (True Color)', {
  fontSize: '11px',
  color: '#5F5E5A',
  margin: '8px 0 0 0'
}));

Map.add(legend);

var lstCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
  .filterBounds(geometry)
  .filterDate('2015-01-01', '2025-12-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 20))
  .map(maskL8sr)
  .select('B10');

var chart = ui.Chart.image.series({
  imageCollection: lstCollection,
  region: geometry,
  reducer: ee.Reducer.mean(),
  scale: 30,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'Tren Brightness Temperature 2015-2025',
  vAxis: {title: 'Kelvin'},
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
  '1. Citra Landsat 8 (Collection 2, TOA) difilter tutupan awan < 20%, ' +
  'lalu di-composite median per tahun.',
  {fontSize: '11px', margin: '0 0 4px 0'}
));

infoPanel.add(ui.Label(
  '2. NDVI dihitung untuk menentukan proporsi vegetasi (PV) dan emisivitas permukaan.',
  {fontSize: '11px', margin: '0 0 4px 0'}
));

infoPanel.add(ui.Label(
  '3. Brightness temperature (band B10) dikonversi menjadi LST (°C) menggunakan ' +
  'algoritma emisivitas-koreksi.',
  {fontSize: '11px', margin: '0 0 10px 0'}
));

infoPanel.add(ui.Label('Sumber data', {
  fontWeight: 'bold',
  fontSize: '13px',
  margin: '0 0 4px 0'
}));

infoPanel.add(ui.Label(
  '• Landsat 8 Collection 2 T1_TOA (True Color & LST)',
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

  var lstTahunIni = lstLayers[tahun].getEeObject();

  lstTahunIni.reduceRegion({
    reducer: ee.Reducer.minMax().combine({
      reducer2: ee.Reducer.mean(),
      sharedInputs: true
    }),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  }).evaluate(function(hasil) {
    var teks =
      'Tahun: ' + tahun + '\n' +
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

  var citraTahunIni = l8TrueColorLayers[tahunTerpilih].getEeObject();
  var lstTahunIni = lstLayers[tahunTerpilih].getEeObject();

  var citraGabungan = citraTahunIni.select(['B2','B3','B4','B5','B6','B7'])
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

    var teks =
      'Tahun: ' + tahunTerpilih + '\n\n' +
      'LST: ' + hasil.LST_CELSIUS.toFixed(2) + ' °C\n\n' +
      'Reflektansi (TOA):\n' +
      '  B2 (Biru): ' + hasil.B2.toFixed(4) + '\n' +
      '  B3 (Hijau): ' + hasil.B3.toFixed(4) + '\n' +
      '  B4 (Merah): ' + hasil.B4.toFixed(4) + '\n' +
      '  B5 (NIR): ' + hasil.B5.toFixed(4) + '\n' +
      '  B6 (SWIR 1): ' + hasil.B6.toFixed(4) + '\n' +
      '  B7 (SWIR 2): ' + hasil.B7.toFixed(4);

    clickContentLabel.setValue(teks);
  });
});




