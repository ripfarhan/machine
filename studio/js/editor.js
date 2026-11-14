/* Machine Studio — the pitch editor: overview strip, time ruler, piano roll with note blobs,
   the sung line and the tuned line. All drawing and pointer handling; edits go back through `api`. */
(function () {
  'use strict';
  const D = window.MachineDSP;
  const KEYW = 50, OVH = 38, RULH = 20;
  const C = {
    bg: '#0b0810', rowIn: '#17121e', rowOut: '#0f0b14', rowRoot: '#1f1626', line: '#241c2d', lineC: '#3a2f47',
    text: '#a296ad', dim: '#6f6579', fg: '#f2ecf5', hot: '#ff3d8b', cyan: '#41e6ff', lime: '#b6ff00', amber: '#ffb53d'
  };

  window.MachineEditor = function (canvas, S, api) {
    const g = canvas.getContext('2d'), view = S.view;
    let W = 0, H = 0, dpr = 1, drag = null, hover = null;

    const rollTop = () => OVH + RULH;
    const X = t => KEYW + (t - view.t0) * view.pps;
    const TT = x => view.t0 + (x - KEYW) / view.pps;
    const Y = m => H - (m - view.p0) * view.ppst;
    const MM = y => view.p0 + (H - y) / view.ppst;
    const fT = f => S.vStart + f * S.an.hop / S.an.sr;
    const tF = t => Math.round((t - S.vStart) * S.an.sr / S.an.hop);
    const target = i => (S.corr ? S.corr.targets[i] : S.notes[i].center) + (S.tune.transpose || 0);

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(50, r.width); H = Math.max(50, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      draw();
    }
    function clampView() {
      const total = S.total();
      view.pps = D.clamp(view.pps, 6, 4000);
      view.ppst = D.clamp(view.ppst, 5, 70);
      const span = (W - KEYW) / view.pps;
      view.t0 = D.clamp(view.t0, -0.3, Math.max(-0.3, total - span * 0.2));
      view.p0 = D.clamp(view.p0, 20, 104);
    }
    function fit() {
      const total = Math.max(1, S.total());
      view.pps = (W - KEYW - 24) / (total + 0.3); view.t0 = -0.15;
      let lo = 52, hi = 72;
      if (S.notes.length) {
        lo = Infinity; hi = -Infinity;
        S.notes.forEach((n, i) => { const t = target(i); lo = Math.min(lo, t, n.center); hi = Math.max(hi, t, n.center); });
      }
      const rollH = H - rollTop();
      view.ppst = D.clamp(rollH / (hi - lo + 7), 9, 30);
      view.p0 = (hi + lo) / 2 - rollH / view.ppst / 2;
      clampView(); draw();
    }
    function zoom(f, ax) {
      const x = ax == null ? (W + KEYW) / 2 : ax, t = TT(x);
      view.pps *= f; clampView(); view.t0 = t - (x - KEYW) / view.pps; clampView(); draw();
    }
    function follow() {
      const x = X(S.play.pos);
      if (x > W - 40 || x < KEYW) { view.t0 = S.play.pos - (W - KEYW) * 0.12 / view.pps; clampView(); }
    }

    // ---------- drawing ----------
    function draw() {
      if (!W) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      const top = rollTop(), an = S.an, mask = D.tuneMask(S.tune), tr = S.tune.transpose || 0;
      // rows
      g.save(); g.beginPath(); g.rect(0, top, W, H - top); g.clip();
      const mLo = Math.floor(MM(H)) - 1, mHi = Math.ceil(MM(top)) + 1, refOff = (S.tune.ref || 0) / 100;
      for (let m = mLo; m <= mHi; m++) {
        const pc = (((m - tr) % 12) + 12) % 12, y1 = Y(m + 0.5 + refOff), y2 = Y(m - 0.5 + refOff);
        g.fillStyle = mask[pc] ? (pc === S.tune.key && !S.tune.custom ? C.rowRoot : C.rowIn) : C.rowOut;
        g.fillRect(KEYW, y1, W - KEYW, y2 - y1);
        g.fillStyle = ((m % 12) + 12) % 12 === 0 ? C.lineC : C.line; g.fillRect(KEYW, y2 - 0.5, W - KEYW, 1);
      }
      // vertical time lines
      const step = tickStep();
      g.fillStyle = C.line;
      for (let t = Math.ceil(view.t0 / step) * step; t < TT(W); t += step) g.fillRect(Math.round(X(t)) - 0.5, top, 1, H - top);
      g.restore();

      g.save(); g.beginPath(); g.rect(KEYW, top, W - KEYW, H - top); g.clip();
      if (S.loop) { g.fillStyle = 'rgba(182,255,0,.06)'; g.fillRect(X(S.loop.a), top, X(S.loop.b) - X(S.loop.a), H - top); }
      if (an) {
        const f0 = Math.max(0, tF(TT(KEYW)) - 2), f1 = Math.min(an.frames, tF(TT(W)) + 2);
        // note blobs
        const rmax = S.rmsMax || 1;
        S.notes.forEach((n, i) => {
          if (n.e < f0 || n.s > f1) return;
          const yc = Y(target(i)), x1 = X(fT(n.s)), x2 = X(fT(n.e)), sel = S.sel.has(n.id);
          const len = n.e - n.s, k = Math.max(1, Math.ceil(len / Math.max(8, (x2 - x1) / 3)));
          const hh = f => { const a = Math.sqrt(Math.min(1, an.rms[Math.min(an.frames - 1, f)] / rmax)); return Math.max(2.5, (0.22 + 0.78 * a) * view.ppst * 0.47); };
          g.beginPath();
          g.moveTo(x1, yc);
          for (let f = n.s; f < n.e; f += k) g.lineTo(X(fT(f + 0.5)), yc - hh(f));
          g.lineTo(x2, yc);
          for (let f = n.s + Math.floor((len - 1) / k) * k; f >= n.s; f -= k) g.lineTo(X(fT(f + 0.5)), yc + hh(f));
          g.closePath();
          g.fillStyle = n.off ? 'rgba(150,140,160,.22)' : sel ? 'rgba(65,230,255,.42)' : 'rgba(255,61,139,.36)';
          g.strokeStyle = n.off ? C.dim : sel ? C.cyan : C.hot; g.lineWidth = sel ? 1.5 : 1;
          g.fill(); g.stroke();
          if (n.manual != null && !n.off) { g.fillStyle = C.amber; g.fillRect(x1 + 1, yc - 3, 2, 6); }
          if (x2 - x1 > 34 && view.ppst > 11) {
            g.fillStyle = n.off ? C.dim : C.fg; g.font = '600 10px JetBrains Mono, monospace'; g.textBaseline = 'middle';
            g.fillText(D.noteName(target(i) - refOff), x1 + 6, yc);
          }
        });
        // lines
        const fstep = Math.max(1, Math.floor(an.sr / an.hop / view.pps / 1.5));
        const line = (arr, color, w, add) => {
          g.strokeStyle = color; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath();
          let pen = false;
          for (let f = f0; f < f1; f += fstep) {
            const v = arr[f];
            if (!v) { pen = false; continue; }
            const x = X(fT(f)), y = Y(v + (add || 0));
            if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; }
          }
          g.stroke();
        };
        line(an.midi, 'rgba(255,255,255,.34)', 1, 0);
        if (S.corr && !S.bypass) {
          if (S.showHarm) for (const h of S.hOut || []) line(h.out, 'rgba(65,230,255,.45)', 1, 0);
          line(S.corr.out, C.lime, 1.6, 0);
        }
      }
      if (drag && drag.type === 'marquee' && drag.moved) {
        g.strokeStyle = C.cyan; g.fillStyle = 'rgba(65,230,255,.08)'; g.lineWidth = 1;
        const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
        g.fillRect(x, y, w, h); g.strokeRect(x + 0.5, y + 0.5, w, h);
      }
      g.restore();

      // piano keys
      g.save(); g.beginPath(); g.rect(0, top, KEYW, H - top); g.clip();
      for (let m = mLo; m <= mHi; m++) {
        const pcAbs = ((m % 12) + 12) % 12, black = [1, 3, 6, 8, 10].includes(pcAbs), y1 = Y(m + 0.5 + refOff), y2 = Y(m - 0.5 + refOff);
        const inScale = mask[(((m - tr) % 12) + 12) % 12];
        g.fillStyle = black ? '#1b1522' : '#cfc6d6'; g.globalAlpha = inScale ? 1 : 0.35;
        g.fillRect(0, y1 + 0.5, KEYW - 1, y2 - y1 - 1); g.globalAlpha = 1;
        if (pcAbs === 0 || view.ppst > 15) {
          g.fillStyle = black ? C.text : '#16111c'; g.font = '600 9px JetBrains Mono, monospace'; g.textBaseline = 'middle';
          g.fillText(D.noteName(m), 5, (y1 + y2) / 2);
        }
      }
      g.restore();

      // overview
      g.fillStyle = '#120d18'; g.fillRect(0, 0, W, OVH);
      const total = Math.max(0.5, S.total()), ox = t => 4 + (t / total) * (W - 8);
      if (S.peaks) {
        g.fillStyle = 'rgba(255,61,139,.75)';
        const P = S.peaks, nb = P.length / 2, dur = S.vocal.x.length / S.vocal.sr, mid = OVH / 2;
        for (let i = 0; i < nb; i++) {
          const x = ox(S.vStart + (i / nb) * dur);
          g.fillRect(x, mid - P[i * 2 + 1] * (mid - 3), Math.max(1, (W - 8) / nb * dur / total), Math.max(1, (P[i * 2 + 1] - P[i * 2]) * (mid - 3)));
        }
      }
      if (S.beat) { g.fillStyle = 'rgba(65,230,255,.16)'; g.fillRect(ox(S.bStart), OVH - 5, ox(S.bStart + S.beat.buffer.duration) - ox(S.bStart), 4); }
      g.strokeStyle = C.fg; g.lineWidth = 1;
      const vx1 = ox(Math.max(0, view.t0)), vx2 = ox(Math.min(total, TT(W)));
      g.strokeRect(vx1 + 0.5, 1.5, Math.max(4, vx2 - vx1), OVH - 3);
      g.fillStyle = C.cyan; g.fillRect(ox(S.play.pos), 0, 1, OVH);

      // ruler
      g.fillStyle = '#191320'; g.fillRect(0, OVH, W, RULH);
      g.fillStyle = C.line; g.fillRect(0, OVH + RULH - 1, W, 1);
      if (S.loop) { g.fillStyle = 'rgba(182,255,0,.35)'; g.fillRect(Math.max(KEYW, X(S.loop.a)), OVH + 2, X(S.loop.b) - Math.max(KEYW, X(S.loop.a)), RULH - 4); }
      g.font = '500 10px JetBrains Mono, monospace'; g.textBaseline = 'middle';
      for (let t = Math.ceil(Math.max(0, view.t0) / step) * step; t < TT(W); t += step) {
        const x = Math.round(X(t)); if (x < KEYW) continue;
        g.fillStyle = C.dim; g.fillRect(x - 0.5, OVH + RULH - 6, 1, 6);
        g.fillStyle = C.text; g.fillText(fmtT(t, step), x + 4, OVH + RULH / 2);
      }
      g.fillStyle = '#191320'; g.fillRect(0, OVH, KEYW, RULH);
      // playhead
      const px = X(S.play.pos);
      if (px >= KEYW && px <= W) { g.fillStyle = C.cyan; g.fillRect(Math.round(px) - 0.5, OVH, 1, H - OVH); g.beginPath(); g.moveTo(px - 5, OVH); g.lineTo(px + 5, OVH); g.lineTo(px, OVH + 7); g.fill(); }
    }
    function tickStep() {
      for (const s of [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120]) if (s * view.pps >= 64) return s;
      return 300;
    }
    function fmtT(t, step) {
      const m = Math.floor(t / 60), s = t - m * 60;
      return m + ':' + (s < 10 ? '0' : '') + (step < 1 ? s.toFixed(step < 0.1 ? 2 : 1) : Math.round(s));
    }

    // ---------- hit testing ----------
    function hitNote(x, y) {
      if (!S.an || x < KEYW || y < rollTop()) return null;
      for (let i = S.notes.length - 1; i >= 0; i--) {
        const n = S.notes[i], x1 = X(fT(n.s)), x2 = X(fT(n.e));
        if (x < x1 - 3 || x > x2 + 3) continue;
        if (Math.abs(y - Y(target(i))) > view.ppst * 0.5 + 2) continue;
        let edge = -1;
        if (x2 - x1 > 14) {
          if (Math.abs(x - x1) <= 4 && i > 0 && S.notes[i - 1].e === n.s) edge = i - 1;
          else if (Math.abs(x - x2) <= 4 && i + 1 < S.notes.length && S.notes[i + 1].s === n.e) edge = i;
        }
        return { i, note: n, edge };
      }
      return null;
    }
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    // ---------- pointer ----------
    canvas.addEventListener('pointerdown', e => {
      canvas.focus();
      const { x, y } = pos(e);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.button === 1 || e.button === 2) { drag = { type: 'pan', x0: x, y0: y, t0: view.t0, p0: view.p0 }; return; }
      if (y < OVH) { drag = { type: 'over' }; overTo(x); return; }
      if (y < OVH + RULH) { drag = { type: 'ruler', x0: x, t0: TT(x), moved: false }; return; }
      if (x < KEYW) { drag = { type: 'pan', x0: x, y0: y, t0: view.t0, p0: view.p0, yOnly: true }; return; }
      const hit = hitNote(x, y);
      if (hit && hit.edge >= 0) { drag = { type: 'bound', i: hit.edge, moved: false }; return; }
      if (hit) {
        const id = hit.note.id;
        if (e.shiftKey) { if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); }
        else if (!S.sel.has(id)) { S.sel.clear(); S.sel.add(id); }
        const orig = new Map();
        S.notes.forEach((n, i) => { if (S.sel.has(n.id)) orig.set(n.id, S.corr.targets[i]); });
        drag = { type: 'note', y0: y, orig, moved: false };
        api.selectionChanged(); draw(); return;
      }
      drag = { type: 'marquee', x0: x, y0: y, x1: x, y1: y, moved: false, add: e.shiftKey };
    });
    canvas.addEventListener('pointermove', e => {
      const { x, y } = pos(e);
      if (!drag) {
        const h = y > rollTop() ? hitNote(x, y) : null;
        canvas.style.cursor = y < OVH ? 'pointer' : y < OVH + RULH ? 'col-resize' : h ? (h.edge >= 0 ? 'ew-resize' : 'ns-resize') : 'default';
        if (h !== hover) hover = h;
        return;
      }
      if (drag.type === 'pan') {
        if (!drag.yOnly) view.t0 = drag.t0 - (x - drag.x0) / view.pps;
        view.p0 = drag.p0 + (y - drag.y0) / view.ppst; clampView(); draw();
      } else if (drag.type === 'over') overTo(x);
      else if (drag.type === 'ruler') {
        if (Math.abs(x - drag.x0) > 4) drag.moved = true;
        if (drag.moved) { const a = Math.max(0, Math.min(drag.t0, TT(x))), b = Math.max(drag.t0, TT(x)); S.loop = { a, b }; draw(); }
      } else if (drag.type === 'note') {
        const d = (drag.y0 - y) / view.ppst;
        if (Math.abs(drag.y0 - y) > 3) drag.moved = true;
        if (!drag.moved) return;
        const mask = D.tuneMask(S.tune);
        for (const n of S.notes) {
          if (!drag.orig.has(n.id)) continue;
          const want = drag.orig.get(n.id) + d;
          n.manual = e.altKey ? Math.round(want * 100) / 100 : D.snapToScale(want, mask, S.tune.ref);
          n.edited = true; n.off = false;
        }
        api.recompute(); api.status(describeDrag());
      } else if (drag.type === 'bound') {
        const a = S.notes[drag.i], b = S.notes[drag.i + 1];
        const f = D.clamp(tF(TT(x)), a.s + 3, b.e - 3);
        if (f !== a.e) {
          a.e = f; b.s = f; drag.moved = true;
          a.center = D.noteCenter(S.an.midi, a.s, a.e); b.center = D.noteCenter(S.an.midi, b.s, b.e);
          a.edited = b.edited = true; api.recompute();
        }
      } else if (drag.type === 'marquee') {
        drag.x1 = x; drag.y1 = y;
        if (Math.abs(x - drag.x0) + Math.abs(y - drag.y0) > 5) drag.moved = true;
        if (drag.moved) {
          const xa = Math.min(drag.x0, x), xb = Math.max(drag.x0, x), ya = Math.min(drag.y0, y), yb = Math.max(drag.y0, y);
          if (!drag.add) S.sel.clear();
          S.notes.forEach((n, i) => {
            const yc = Y(target(i));
            if (X(fT(n.e)) >= xa && X(fT(n.s)) <= xb && yc + view.ppst / 2 >= ya && yc - view.ppst / 2 <= yb) S.sel.add(n.id);
          });
          api.selectionChanged(); draw();
        }
      }
    });
    function describeDrag() {
      const out = [];
      S.notes.forEach((n, i) => { if (S.sel.has(n.id) && out.length < 4) out.push(D.noteName(S.corr.targets[i] - (S.tune.ref || 0) / 100)); });
      return 'Pitch → ' + out.join(' ') + '   (hold Alt for free pitch)';
    }
    function end(e) {
      if (!drag) return;
      const d = drag; drag = null;
      const { x } = pos(e);
      if (d.type === 'ruler') { if (!d.moved) api.seek(Math.max(0, d.t0)); else api.loopChanged(); }
      else if (d.type === 'note') { if (d.moved) { api.commit(); api.requestRender(); api.selectionChanged(); } }
      else if (d.type === 'bound') { if (d.moved) { api.commit(); api.requestRender(); } }
      else if (d.type === 'marquee' && !d.moved) {
        if (S.sel.size && !d.add) { S.sel.clear(); api.selectionChanged(); }
        api.seek(Math.max(0, TT(x)));
      }
      draw();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dblclick', e => {
      const { x, y } = pos(e);
      if (y >= OVH && y < OVH + RULH) { S.loop = null; api.loopChanged(); draw(); return; }
      const h = hitNote(x, y);
      if (h) api.splitNote(h.note, tF(TT(x)));
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const { x, y } = pos(e), k = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey || e.metaKey) zoom(Math.exp(-e.deltaY * k * 0.003), Math.max(KEYW, x));
      else if (e.altKey) { const m = MM(y); view.ppst *= Math.exp(-e.deltaY * k * 0.003); clampView(); view.p0 = m - (H - y) / view.ppst; clampView(); draw(); }
      else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
        view.t0 += dx * k / view.pps; view.p0 -= dy * k / view.ppst; clampView(); draw();
      }
    }, { passive: false });
    function overTo(x) {
      const total = Math.max(0.5, S.total()), t = (x - 4) / (W - 8) * total;
      view.t0 = t - (W - KEYW) / view.pps / 2; clampView(); draw();
    }

    new ResizeObserver(resize).observe(canvas);
    return { draw, resize, fit, zoom, follow, clampView };
  };
})();
