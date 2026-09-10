/* ============================================================
   Pengelola efek suara — Ular Tangga Matematika
   ============================================================

   Cara pakai dari halaman mana pun:

       <script src="js/suara.js"></script>
       ...
       Suara.mainkan('dadu');

   Nama efek yang tersedia: klik, langkah, dadu, benar, salah,
   ular, tangga, juara. Berkasnya ada di asset/suara/.

   Tiga hal yang perlu diketahui kalau nanti diubah-ubah:

   1) Tombol speaker & slider volume yang sudah ada TIDAK perlu
      disentuh. Modul ini membaca keadaan langsung dari elemen
      <audio> musik latar di halaman (#backgroundAudio atau
      #bgAudio); kalau halamannya tidak punya musik latar
      (misalnya juara.html), keadaannya dibaca dari localStorage
      yang dipakai tombol itu. Jadi sekali dibisukan, efek
      suaranya ikut diam.

   2) Setiap efek punya beberapa salinan <audio> ("kolam") supaya
      bunyinya bisa bertumpuk. Ini penting untuk suara langkah:
      pion melangkah tiap 200 ms sedangkan bunyinya lebih panjang
      dari itu, jadi kalau cuma satu salinan, langkah berikutnya
      akan memotong yang sebelumnya.

   3) Suara klik dipasang otomatis ke semua yang bisa diklik
      (lihat BISA_DIKLIK di bawah), jadi tombol baru tidak perlu
      didaftarkan. Kalau satu elemen sudah punya bunyi sendiri —
      dadu, misalnya — beri atribut data-tanpa-klik supaya tidak
      berbunyi dua kali.
   ============================================================ */
(function (global) {
  'use strict';

  /* Akar proyek dihitung dari lokasi berkas skrip ini, bukan dari
     alamat halaman, supaya jalannya tetap benar walau halamannya
     dipindah ke subfolder. */
  var AKAR = (function () {
    var s = document.currentScript;
    if (!s || !s.src) return '';
    return s.src.replace(/[^/]*$/, '').replace(/(^|\/)js\/$/, '$1');
  })();

  /* keras : kelantangan dasar tiap efek, dikali volume slider.
     kolam : jumlah salinan <audio> supaya bunyinya bisa bertumpuk.
     nada  : besarnya variasi tinggi nada acak (0 = selalu sama),
             dipakai supaya bunyi yang sering berulang tidak
             terdengar seperti mesin. */
  var EFEK = {
    klik:    { berkas: 'klik.mp3',    keras: 0.42, kolam: 4, nada: 0.03 },
    langkah: { berkas: 'langkah.mp3', keras: 0.52, kolam: 4, nada: 0.06 },
    dadu:    { berkas: 'dadu.mp3',    keras: 0.60, kolam: 2 },
    benar:   { berkas: 'benar.mp3',   keras: 0.65, kolam: 2 },
    salah:   { berkas: 'salah.mp3',   keras: 0.55, kolam: 2 },
    ular:    { berkas: 'ular.mp3',    keras: 0.62, kolam: 2 },
    tangga:  { berkas: 'tangga.mp3',  keras: 0.62, kolam: 2 },
    juara:   { berkas: 'juara.mp3',   keras: 0.78, kolam: 1 }
  };

  var BISA_DIKLIK = [
    'button', 'a[href]', 'input', 'select', 'textarea', 'label', 'summary',
    '[role="button"]', '[onclick]', '.btn', '.dice-box', '.popup-close',
    '.modal-close-btn', '.pilihan', '.option', '.opsi'
  ].join(',');

  var LS_BISU = 'mtkgame-audio-muted';
  var LS_VOLUME = 'mtkgame-audio-volume';

  var kolam = {};          // nama efek -> array elemen <audio>
  var klikTerakhir = 0;

  /* ---------- keadaan bisu & volume ---------- */

  function elemenMusik() {
    return document.getElementById('backgroundAudio') ||
           document.getElementById('bgAudio') || null;
  }

  function keadaan() {
    var el = elemenMusik();
    if (el) {
      return {
        bisu: !!el.muted,
        volume: isFinite(el.volume) ? Math.max(0, Math.min(el.volume, 1)) : 1
      };
    }
    var bisu = false, volume = 1;
    try {
      bisu = localStorage.getItem(LS_BISU) === 'true';
      var v = parseFloat(localStorage.getItem(LS_VOLUME));
      if (!isNaN(v)) volume = Math.max(0, Math.min(v / 100, 1));
    } catch (e) { /* file:// kadang menolak localStorage — anggap normal */ }
    return { bisu: bisu, volume: volume };
  }

  /* ---------- kolam <audio> ---------- */

  function buat(def) {
    var a = new Audio(AKAR + 'asset/suara/' + def.berkas);
    a.preload = 'auto';
    return a;
  }

  function siapkan(nama) {
    var def = EFEK[nama];
    if (!def) return null;
    if (!kolam[nama]) kolam[nama] = [buat(def)];
    return kolam[nama];
  }

  function ambil(nama) {
    var def = EFEK[nama];
    var daftar = siapkan(nama);
    for (var i = 0; i < daftar.length; i++) {
      if (daftar[i].paused || daftar[i].ended) return daftar[i];
    }
    if (daftar.length < def.kolam) {
      var baru = buat(def);
      daftar.push(baru);
      return baru;
    }
    // semua sedang berbunyi: pakai yang paling lama berjalan
    var pilih = daftar[0];
    for (var j = 1; j < daftar.length; j++) {
      if (daftar[j].currentTime > pilih.currentTime) pilih = daftar[j];
    }
    return pilih;
  }

  /* ---------- pemutar ---------- */

  function mainkan(nama) {
    var def = EFEK[nama];
    if (!def) return null;
    var st = keadaan();
    if (st.bisu || st.volume <= 0.001) return null;
    var a = ambil(nama);
    if (!a) return null;
    try {
      a.volume = Math.max(0, Math.min(def.keras * st.volume, 1));
      if (def.nada) {
        // preservesPitch dimatikan supaya playbackRate benar-benar
        // mengubah tinggi nada, bukan cuma kecepatannya
        if ('preservesPitch' in a) a.preservesPitch = false;
        if ('mozPreservesPitch' in a) a.mozPreservesPitch = false;
        if ('webkitPreservesPitch' in a) a.webkitPreservesPitch = false;
        a.playbackRate = 1 + (Math.random() * 2 - 1) * def.nada;
      }
      a.currentTime = 0;
      var janji = a.play();
      if (janji && janji.catch) janji.catch(function () {});
    } catch (e) { /* diabaikan: suara tidak boleh menggagalkan permainan */ }
    return a;
  }

  function hentikan(nama) {
    var daftar = kolam[nama];
    if (!daftar) return;
    daftar.forEach(function (a) {
      try { a.pause(); a.currentTime = 0; } catch (e) {}
    });
  }

  /* ---------- suara klik otomatis ---------- */

  function bolehBerbunyi(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return false;
    if (el.closest && el.closest('[data-tanpa-klik]')) return false;
    return true;
  }

  function bunyikanKlik() {
    var sekarang = Date.now();
    // satu tindakan pengguna = satu bunyi (pointerdown + keydown bisa
    // sama-sama kena pada tombol yang ditekan lewat papan ketik)
    if (sekarang - klikTerakhir < 80) return;
    klikTerakhir = sekarang;
    mainkan('klik');
  }

  function pasangKlikOtomatis() {
    document.addEventListener('pointerdown', function (e) {
      if (typeof e.button === 'number' && e.button !== 0) return;
      var t = e.target;
      if (!t || !t.closest) return;
      var el = t.closest(BISA_DIKLIK);
      if (el && bolehBerbunyi(el)) bunyikanKlik();
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      if (e.repeat) return;
      var t = e.target;
      if (!t || !t.closest) return;
      var el = t.closest(BISA_DIKLIK);
      if (el && bolehBerbunyi(el)) bunyikanKlik();
    }, true);
  }

  /* Peramban baru menolak memutar suara sebelum ada sentuhan/klik
     dari pengguna. Sentuhan pertama dipakai untuk "membuka kunci":
     berkasnya diputar sekejap dengan volume nol supaya bunyi
     berikutnya langsung keluar tanpa tertunda. */
  function bukaKunci() {
    Object.keys(EFEK).forEach(function (nama) {
      var daftar = siapkan(nama);
      var a = daftar[0];
      try {
        var vol = a.volume;
        a.volume = 0;
        var janji = a.play();
        var kembalikan = function () {
          try { a.pause(); a.currentTime = 0; a.volume = vol; } catch (e) {}
        };
        if (janji && janji.then) janji.then(kembalikan, kembalikan);
        else kembalikan();
      } catch (e) {}
    });
  }

  function mulai() {
    Object.keys(EFEK).forEach(siapkan);      // pramuat berkasnya
    pasangKlikOtomatis();
    window.addEventListener('pointerdown', bukaKunci, { once: true, passive: true });
    window.addEventListener('keydown', bukaKunci, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mulai);
  } else {
    mulai();
  }

  global.Suara = {
    mainkan: mainkan,
    hentikan: hentikan,
    klik: bunyikanKlik,
    keadaan: keadaan,
    get bisu() { return keadaan().bisu; }
  };
})(window);
