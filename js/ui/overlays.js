/* Шторка, модальные окна, боковое меню, уведомления и общие компоненты. */
(function () {
  const $ = GIR.$, F = GIR.fmt;
  const isDesk = () => innerWidth >= 820;

  /* ---------- шторка ----------
     На телефоне её можно тянуть за ручку (или за любое место, когда содержимое не прокручивается).
     Режимы: 'auto'   — обычная шторка: open (раскрыта) / min (опущена, видна карта);
             'expand' — главный экран: peek (до блока opts.peek) / full (раскрыта, видно всё). */
  const st = { mode: 'auto', snap: 'open', peek: null, offset: 0 };
  const el = () => $('#sheet');

  function offsets() {
    const h = el().offsetHeight;
    if (st.mode === 'expand') {
      const p = st.peek && $(st.peek);
      // от верха шторки до низа блока-«окна» (через getBoundingClientRect — не зависит от offsetParent)
      const bottom = p ? p.getBoundingClientRect().bottom - el().getBoundingClientRect().top : h;
      const peekH = p ? Math.min(h, Math.ceil(bottom) + 16) : h;
      return { full: 0, peek: Math.max(0, h - peekH) };
    }
    // опущенная шторка: видна полоска до блока opts.min (в поездке — время, прибытие, пауза, скорость)
    const m = st.min && $(st.min);
    const minH = m ? Math.ceil(m.getBoundingClientRect().bottom - el().getBoundingClientRect().top) + 14 : 70;
    return { open: 0, min: Math.max(0, h - minH) };
  }

  function apply(animate) {
    const s = el();
    if (isDesk()) {
      s.classList.remove('peeked', 'is-full', 'minned');
      s.style.transform = '';
      s.style.overflowY = '';
      st.offset = 0;
      placeBtns();
      return;
    }
    const o = offsets();
    st.offset = o[st.snap] || 0;
    s.style.transition = animate === false ? 'none' : '';
    s.style.transform = st.offset ? `translateY(${st.offset}px)` : '';
    s.style.overflowY = st.snap === 'peek' || st.snap === 'min' ? 'hidden' : 'auto';
    s.classList.toggle('is-full', st.mode === 'expand' && st.snap === 'full');
    s.classList.toggle('peeked', st.snap === 'peek'); // содержимое ниже «окна» не торчит
    s.classList.toggle('minned', st.snap === 'min');
    placeBtns();
  }

  const sheet = {
    set(html, opts) {
      opts = opts || {};
      const s = el();
      s.classList.toggle('tall', !!opts.tall);
      s.classList.toggle('expandable', !!opts.peek);
      st.mode = opts.peek ? 'expand' : 'auto';
      st.peek = opts.peek || null;
      st.min = opts.min || null;
      // тот же экран перерисовался (например, поездка после шлюза) — оставляем шторку как была
      const sameScreen = !!opts.key && opts.key === st.key;
      const keep = sameScreen && st.snap === 'min';
      st.key = opts.key || null;
      st.snap = keep ? 'min' : st.mode === 'expand' ? 'peek' : 'open';
      const body = $('#sheetBody');
      body.innerHTML = html;
      body.classList.remove('fade-in');
      // анимация появления — только при смене экрана, а не при перерисовке того же (без мигания)
      if (!sameScreen) { void body.offsetWidth; body.classList.add('fade-in'); }
      s.scrollTop = 0;
      apply();
      setTimeout(() => apply(), 0); // после того как браузер посчитает высоты
    },
    /** Видимая высота шторки (для камеры карты и кнопок). */
    height() {
      const s = el();
      return isDesk() ? s.getBoundingClientRect().height : Math.max(0, s.offsetHeight - st.offset);
    },
    snap(name) { st.snap = name; apply(); },
    refresh: () => apply(),
    justDragged: 0
  };

  /* перетаскивание */
  let drag = null;
  function dragStart(y, target) {
    if (isDesk() || !target.closest('#sheet')) return;
    drag = { y0: y, off0: st.offset, active: false, grab: !!target.closest('.grab-zone'), scrollTop: el().scrollTop, t0: performance.now(), lastY: y, lastT: performance.now() };
  }
  function dragMove(y, e) {
    if (!drag) return;
    const dy = y - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) < 8) return;
      const scrollable = el().style.overflowY !== 'hidden' && el().scrollHeight > el().clientHeight + 2;
      if (drag.grab || !scrollable || (dy > 0 && drag.scrollTop <= 0)) {
        drag.active = true;
        el().style.transition = 'none';
      } else { drag = null; return; }
    }
    if (e.cancelable) e.preventDefault();
    const o = offsets();
    const maxOff = Math.max(...Object.values(o));
    let off = drag.off0 + dy;
    if (off < 0) off /= 3;                       // «резинка» вверх
    off = Math.min(off, maxOff + 40);
    st.offset = off;
    el().style.transform = `translateY(${off}px)`;
    drag.v = (y - drag.lastY) / Math.max(1, performance.now() - drag.lastT); // px/мс
    drag.lastY = y; drag.lastT = performance.now();
    placeBtns();
  }
  function dragEnd() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    sheet.justDragged = performance.now();
    el().style.transition = '';
    const o = offsets();
    const names = Object.keys(o).sort((a, b) => o[a] - o[b]); // от самого раскрытого
    let best;
    if (Math.abs(d.v || 0) > 0.4) best = d.v < 0 ? names[0] : names[names.length - 1];
    else best = names.reduce((a, b) => (Math.abs(o[b] - st.offset) < Math.abs(o[a] - st.offset) ? b : a));
    st.snap = best;
    apply();
  }
  /* тап по ручке — раскрыть / свернуть */
  function grabTap() {
    if (isDesk()) return;
    if (st.mode === 'expand') st.snap = st.snap === 'peek' ? 'full' : 'peek';
    else st.snap = st.snap === 'open' ? 'min' : 'open';
    apply();
  }

  document.addEventListener('touchstart', (e) => dragStart(e.touches[0].clientY, e.target), { passive: true });
  document.addEventListener('touchmove', (e) => dragMove(e.touches[0].clientY, e), { passive: false });
  document.addEventListener('touchend', dragEnd);
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) dragStart(e.clientY, e.target); });
  addEventListener('mousemove', (e) => drag && dragMove(e.clientY, e));
  addEventListener('mouseup', dragEnd);
  document.addEventListener('click', (e) => {
    if (e.target.closest('.grab-zone') && performance.now() - sheet.justDragged > 300) grabTap();
  });

  function placeBtns() {
    const h = sheet.height();
    const bottom = (isDesk() ? 24 : h + 14) + 'px';
    $('#mapBtns').style.bottom = bottom;
    $('#legend').style.bottom = bottom;
    // шторка раскрыта почти на весь экран — кнопки карты прячем
    $('#mapBtns').classList.toggle('away', !isDesk() && h > innerHeight * 0.7);
  }

  function toast(text, ms = 2800) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), ms);
  }

  function openModal(html) {
    $('#modal').innerHTML = `<button class="modal-close" data-act="closeAll" aria-label="Закрыть">${GIR.I.close}</button>` + html;
    $('#modal').classList.add('show');
    $('#overlay').classList.add('show');
  }

  function closeAll() {
    $('#modal').classList.remove('show');
    $('#drawer').classList.remove('show');
    $('#overlay').classList.remove('show');
  }

  function openDrawer(html) {
    $('#drawer').innerHTML = html;
    $('#drawer').classList.add('show');
    $('#overlay').classList.add('show');
  }

  /* Полоса маршрута: дорога / коридор / дорога, пропорционально длине */
  const weights = (r) => r.legs.map((l) => Math.max(l.km, r.totalKm * 0.06));

  function timeline(r, live) {
    const w = weights(r);
    return `<div class="tl"><div class="tl-bar">
        ${r.legs.map((l, i) => `<i class="tl-seg ${l.type}" style="flex:${w[i]}"></i>`).join('')}
        ${live ? '<i class="tl-done" id="tlDone"></i><i class="tl-pos" id="tlPos"></i>' : ''}
      </div></div>`;
  }

  /** Позиция на полосе в процентах с учётом неравных весов. */
  function timelinePos(r, km) {
    const w = weights(r);
    const W = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < r.legs.length; i++) {
      const l = r.legs[i];
      if (km <= l.endKm || i === r.legs.length - 1) {
        const f = l.km > 0 ? Math.min(1, Math.max(0, (km - l.startKm) / l.km)) : 1;
        return ((acc + w[i] * f) / W) * 100;
      }
      acc += w[i];
    }
    return 100;
  }

  GIR.ui = { sheet, placeBtns, toast, modal: { open: openModal, close: closeAll }, drawer: { open: openDrawer }, closeAll, isDesk, timeline, timelinePos };
})();
