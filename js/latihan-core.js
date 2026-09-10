/* ============================================
   LATIHAN-CORE.JS
   Mesin bersama untuk halaman latihan interaktif
   (perkalian & pembagian).

   Setiap level cuma perlu menyediakan build(host, api).
   api.win(pesan)  -> ronde selesai & benar
   api.no(pesan)   -> jawaban salah (boleh dicoba lagi)
   api.tip(pesan)  -> petunjuk / info netral
   api.clearMsg()  -> hapus pesan
   ============================================ */
(function (global) {
  'use strict';

  /* Efek suara bersifat opsional: halaman yang belum memuat
     js/suara.js tetap jalan normal, cuma tanpa bunyi. */
  function bunyi(nama) {
    if (global.Suara) global.Suara.mainkan(nama);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var Latihan = {
    el: el,
    shuffle: shuffle,

    init: function (cfg) {
      this.cfg = cfg;
      this.levels = cfg.levels;
      this.storeKey = 'mtk-latihan-' + cfg.subject;

      this.levelBar = document.getElementById('levelBar');
      this.board = document.getElementById('activityBoard');

      this.unlocked = this.loadProgress();
      this.current = 0;

      this.renderLevelBar();
      this.openLevel(0);
    },

    /* ---------- Progress ---------- */
    loadProgress: function () {
      try {
        var v = parseInt(localStorage.getItem(this.storeKey), 10);
        if (!isNaN(v) && v >= 0) return Math.min(v, this.levels.length);
      } catch (e) { /* localStorage bisa diblokir — abaikan */ }
      return 0;   // jumlah level yang sudah lulus
    },

    saveProgress: function (n) {
      this.unlocked = Math.max(this.unlocked, n);
      try { localStorage.setItem(this.storeKey, String(this.unlocked)); } catch (e) {}
    },

    /* ---------- Bar level ---------- */
    renderLevelBar: function () {
      var self = this;
      this.levelBar.innerHTML = '';
      this.levels.forEach(function (lv, i) {
        var locked = i > self.unlocked;
        var done = i < self.unlocked;
        var chip = el('div', 'level-chip' + (locked ? ' locked' : '') + (done ? ' done' : '') +
          (i === self.current ? ' active' : ''));
        chip.appendChild(el('span', 'level-chip-num', 'Level ' + (i + 1)));
        chip.appendChild(el('span', 'level-chip-name', lv.name));
        chip.appendChild(el('span', 'level-chip-state', locked ? '🔒' : (done ? '✓' : '▶')));
        chip.addEventListener('click', function () {
          if (locked) {
            self.flashLocked(chip);
            return;
          }
          self.openLevel(i);
        });
        self.levelBar.appendChild(chip);
      });
    },

    flashLocked: function (chip) {
      chip.classList.add('shake');
      setTimeout(function () { chip.classList.remove('shake'); }, 400);
    },

    /* ---------- Menjalankan level ---------- */
    openLevel: function (i) {
      this.current = i;
      this.round = 0;
      this.renderLevelBar();
      this.buildRound();
    },

    buildRound: function () {
      var self = this;
      var lv = this.levels[this.current];

      this.board.innerHTML = '';

      var head = el('div', 'act-head');
      head.appendChild(el('div', 'act-badge', 'Level ' + (this.current + 1)));
      head.appendChild(el('h2', 'act-title', lv.name));
      head.appendChild(el('div', 'act-progress',
        'Soal ' + (this.round + 1) + ' dari ' + lv.rounds));
      this.board.appendChild(head);

      var host = el('div', 'act-host');
      this.board.appendChild(host);

      var msg = el('div', 'act-msg');
      this.board.appendChild(msg);
      this.msgEl = msg;

      var api = {
        round: this.round,
        rounds: lv.rounds,
        win: function (text) { self.onWin(text); },
        no: function (text) { bunyi('salah'); self.say(text, 'no'); },
        tip: function (text) { self.say(text, 'tip'); },
        ok: function (text) { self.say(text, 'ok'); },
        clearMsg: function () { self.say('', null); }
      };

      lv.build(host, api);
    },

    say: function (text, kind) {
      var m = this.msgEl;
      if (!m) return;
      if (!text) { m.className = 'act-msg'; m.textContent = ''; return; }
      m.className = 'act-msg show ' + kind;
      m.textContent = text;
    },

    onWin: function (text) {
      var self = this;
      var lv = this.levels[this.current];
      bunyi('benar');
      this.say(text || 'Benar! Hebat!', 'ok');

      // matikan input supaya tidak bisa dijawab dua kali
      Array.prototype.forEach.call(
        this.board.querySelectorAll('input, button'),
        function (n) { n.disabled = true; }
      );

      var last = this.round >= lv.rounds - 1;
      var row = el('div', 'answer-row');
      var btn = el('button', 'btn-check', last ? 'Selesai!' : 'Soal Berikutnya →');
      btn.addEventListener('click', function () {
        if (last) self.levelClear();
        else { self.round++; self.buildRound(); }
      });
      row.appendChild(btn);
      this.board.appendChild(row);
      setTimeout(function () { btn.focus({ preventScroll: true }); }, 120);
    },

    levelClear: function () {
      var self = this;
      var lv = this.levels[this.current];
      bunyi('juara');            // satu level tuntas: pantas dapat fanfare
      this.saveProgress(this.current + 1);
      this.renderLevelBar();

      this.board.innerHTML = '';
      var wrap = el('div', 'level-clear');
      wrap.appendChild(el('div', 'level-clear-emoji', '🎉'));
      wrap.appendChild(el('h3', null, 'Level ' + (this.current + 1) + ' selesai!'));
      wrap.appendChild(el('p', null, lv.clearText || 'Kerja bagus! Kamu sudah paham level ini.'));

      var btns = el('div', 'level-clear-btns');
      var next = this.current + 1;
      if (next < this.levels.length) {
        var bNext = el('button', 'btn-check', 'Lanjut ke Level ' + (next + 1) + ' →');
        bNext.addEventListener('click', function () { self.openLevel(next); });
        btns.appendChild(bNext);
      } else {
        var done = el('div', 'act-msg show ok');
        done.textContent = 'Semua level selesai! Sekarang kamu siap main Ular Tangga 🐍🎲';
        wrap.appendChild(done);
        var bGame = el('button', 'btn-check', 'Main Ular Tangga →');
        bGame.addEventListener('click', function () { window.location.href = 'ulartangga.html'; });
        btns.appendChild(bGame);
      }

      var bAgain = el('button', 'btn-ghost', 'Ulangi level ini');
      bAgain.addEventListener('click', function () { self.openLevel(self.current); });
      btns.appendChild(bAgain);

      var papan = el('div', 'paper');
      papan.appendChild(wrap);
      wrap.appendChild(btns);
      this.board.appendChild(papan);
    },

    /* ---------- Bantu: baris input jawaban ---------- */
    /* onSubmit(nilai, inputEl) -> true kalau benar */
    answerRow: function (host, opts) {
      var row = el('div', 'answer-row');
      var input = el('input', 'answer-input');
      input.type = 'number';
      input.setAttribute('inputmode', 'numeric');
      input.placeholder = opts.placeholder || '?';
      if (opts.label) input.setAttribute('aria-label', opts.label);

      var btn = el('button', 'btn-check', opts.btnText || 'Periksa');

      function submit() {
        var raw = input.value.trim();
        if (raw === '') { input.classList.add('shake'); input.focus();
          setTimeout(function () { input.classList.remove('shake'); }, 400); return; }
        var ok = opts.onSubmit(Number(raw), input);
        if (!ok) {
          input.classList.add('shake');
          setTimeout(function () { input.classList.remove('shake'); }, 400);
          input.select();
        }
      }

      btn.addEventListener('click', submit);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });

      row.appendChild(input);
      row.appendChild(btn);
      host.appendChild(row);
      setTimeout(function () { input.focus({ preventScroll: true }); }, 140);
      return { row: row, input: input, button: btn };
    },

    /* ---------- Bantu: mesin langkah untuk bersusun & porogapit ---------- */
    /* steps: [{ prompt, expect, fill(value), hint }] */
    runSteps: function (host, steps, api, doneText) {
      var idx = 0;
      var promptEl = el('div', 'step-prompt');
      host.appendChild(promptEl);

      var ctl = this.answerRow(host, {
        onSubmit: function (val) {
          var st = steps[idx];
          if (val !== st.expect) {
            api.no(st.hint || 'Belum tepat. Coba hitung lagi ya!');
            return false;
          }
          if (st.fill) st.fill(val);
          api.clearMsg();
          idx++;
          if (idx >= steps.length) {
            ctl.input.value = '';
            api.win(doneText);
            return true;
          }
          ctl.input.value = '';
          render();
          setTimeout(function () { ctl.input.focus({ preventScroll: true }); }, 60);
          return true;
        }
      });

      function render() {
        var st = steps[idx];
        promptEl.innerHTML = '<span class="hl">Langkah ' + (idx + 1) + ' dari ' +
          steps.length + '</span><br>' + st.prompt;
        if (st.mark) st.mark();
      }

      render();
      return ctl;
    }
  };

  global.Latihan = Latihan;
})(window);
