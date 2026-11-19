/* Поиск: одна строка ввода (как в такси), «Откуда» отдельной строкой,
   популярные места сразу, адреса — через геокодер по мере ввода. */
(function () {
  const S = GIR.state, F = GIR.fmt, I = GIR.I, $ = GIR.$, esc = GIR.esc;
  let timer = 0;
  let found = [];      // результаты геокодера
  let loading = false;
  const extra = {};    // найденные адреса по id, чтобы выбрать по клику

  function show(field) {
    S.field = field || 'to';
    S.query = '';
    S.view = 'search';
    found = [];
    loading = false;
    render();
  }

  function render() {
    const isTo = S.field === 'to';
    GIR.ui.sheet.set(`
      <div class="sbar">
        <button class="sbar-back" data-act="${isTo ? 'searchBack' : 'searchTo'}" data-fast aria-label="Назад">${I.back}</button>
        <label class="sbox">
          <i class="dot ${isTo ? 'b' : 'a'}"></i>
          <input id="q" placeholder="${isTo ? 'Куда едем?' : 'Откуда едем?'}" autocomplete="off" enterkeyhint="search">
          <button class="sbox-clear" data-act="clearQuery" data-fast aria-label="Очистить" hidden>${I.close}</button>
        </label>
      </div>
      ${isTo ? `
        <button class="from-row" data-act="searchFrom">
          <i class="dot a"></i><span>Откуда</span><b>${esc(S.from ? S.from.n : 'Не выбрано')}</b><em>Изменить</em>
        </button>` : ''}
      <div class="chips">
        <button class="chip" data-act="pickOnMap">${I.map}На карте</button>
        ${!isTo ? `<button class="chip" data-act="choose" data-arg="me">${I.locate}Я здесь</button>` : ''}
        ${!isTo ? `<button class="chip" data-act="choose" data-arg="home">${I.home}Дом</button>` : ''}
      </div>
      <div id="results"></div>
    `, { tall: true });

    const q = $('#q');
    q.addEventListener('input', () => onInput(q.value));
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const first = $('#results [data-act="choose"]'); if (first) first.click(); }
    });
    results();
    setTimeout(() => q.focus(), 60);
  }

  function onInput(v) {
    S.query = v.trim();
    $('.sbox-clear').hidden = !S.query;
    clearTimeout(timer);
    found = [];
    if (S.query.length >= 3) {
      loading = true;
      timer = setTimeout(async () => {
        const ref = S.from ? S.from.ll : GIR.config.MAP_CENTER;
        const res = await GIR.geocoder.search(S.query, ref);
        if (res === null) return; // запрос отменён новым
        loading = false;
        found = res;
        found.forEach((p) => (extra[p.id] = p));
        results();
      }, 300);
    } else {
      loading = false;
    }
    results();
  }

  function row(p, ref) {
    return `<button class="item" data-act="choose" data-arg="${esc(p.id)}">
      <span class="item-ico">${I[p.ic] || I.pin}</span>
      <div><b>${esc(p.n)}</b><span>${esc(p.s)}</span></div>
      ${ref ? `<span class="item-meta">${F.km(GIR.geo.hav(ref, p.ll))}</span>` : ''}
    </button>`;
  }

  function results() {
    const box = $('#results');
    if (!box) return;
    const q = S.query.toLowerCase();
    const ref = S.field === 'to' && S.from ? S.from.ll : null;
    const local = GIR.data.places.filter((p) =>
      (S.field === 'from' || p.id !== 'home') &&
      (!q || p.n.toLowerCase().includes(q) || p.s.toLowerCase().includes(q)));

    let html = '';
    if (!q) {
      if (S.field === 'from') html += row(GIR.location.place(), null);
      html += `<div class="list-title">Популярное</div>` + local.map((p) => row(p, ref)).join('');
    } else {
      if (local.length) html += local.map((p) => row(p, ref)).join('');
      if (found.length) html += `<div class="list-title">Адреса</div>` + found.map((p) => row(p, ref)).join('');
      if (loading) html += `<div class="searching"><span class="mini-spin"></span>Ищем адреса…</div>`;
      else if (!local.length && !found.length && q.length >= 3) html += '<div class="empty">Ничего не нашли. Попробуйте улицу и номер дома.</div>';
      else if (!local.length && q.length < 3) html += '<div class="empty">Введите ещё пару букв</div>';
    }
    box.innerHTML = html;
  }

  function choose(id) {
    const p = id === 'me' ? GIR.location.place() : GIR.data.places.find((x) => x.id === id) || extra[id];
    if (!p) return;
    GIR.mapView.clearPois();
    S[S.field] = p;
    if (S.field === 'from') { show('to'); return; }
    if (!S.from) { show('from'); return; }
    if (GIR.geo.hav(S.from.ll, S.to.ll) < 0.05) { GIR.ui.toast('Вы уже на месте — выберите другую точку'); return; }
    GIR.screens.route.show();
  }

  /* ---------- категория: кафе, рестораны, парки… рядом с вами ---------- */
  let catSeq = 0;
  async function category(id) {
    const cat = GIR.data.categories.find((c) => c.id === id);
    if (!cat) return;
    S.view = 'category';
    S.field = 'to';
    const seq = ++catSeq;
    const near = GIR.location.ll;
    GIR.mapView.clearRoute();
    GIR.ui.sheet.set(`
      <div class="cat-head">
        <button class="sbar-back" data-act="catBack" data-fast aria-label="Назад">${I.back}</button>
        <span class="cat-badge" style="--c:${cat.color}">${I[cat.ic]}</span>
        <div><b>${cat.n}</b><span>рядом с вами</span></div>
      </div>
      <div id="catList">${'<div class="skeleton"></div>'.repeat(5)}</div>
    `);
    GIR.mapView.follow(near, 15);
    const list = await GIR.geocoder.category(cat, near);
    if (seq !== catSeq || S.view !== 'category') return;
    list.forEach((p) => (extra[p.id] = p));
    const box = $('#catList');
    if (!list.length) {
      box.innerHTML = '<div class="empty">Не нашли ничего поблизости. Попробуйте поиск по названию.</div>';
      return;
    }
    box.innerHTML = list.map((p) => `
      <button class="item" data-act="choose" data-arg="${esc(p.id)}">
        <span class="item-ico tint" style="--c:${cat.color}">${I[cat.ic]}</span>
        <div><b>${esc(p.n)}</b><span>${esc(p.s)}</span></div>
        <span class="item-meta">${F.km(p.d)}</span>
      </button>`).join('');
    box.classList.add('stagger');
    GIR.mapView.showPois(list, cat, choose);
    GIR.mapView.fit([near].concat(list.slice(0, 8).map((p) => p.ll)));
  }

  /* ---------- выбор точки на карте: булавка в центре, карта двигается под ней ---------- */
  let picked = null;   // { ll, place }
  let geoTimer = 0;

  /* булавка всегда ровно в центре экрана (панель выбора внизу маленькая и центр не закрывает) */
  function pinXY() {
    return [Math.round(innerWidth / 2), Math.round(innerHeight / 2)];
  }

  function placePin() {
    const [x, y] = pinXY();
    const pin = $('#picker');
    pin.style.left = x + 'px';
    pin.style.top = y + 'px';
  }

  function pickOnMap() {
    S.pick = S.field;
    S.view = 'pick';
    const isTo = S.field === 'to';
    GIR.ui.sheet.set(`
      <button class="back" data-act="pickCancel">${I.back}<span>${isTo ? 'Куда едем' : 'Откуда едем'}</span></button>
      <div class="pick-addr">
        <i class="dot ${isTo ? 'b' : 'a'}"></i>
        <div><b id="pickTitle">Определяем адрес…</b><span id="pickSub">Двигайте карту, чтобы выбрать точку</span></div>
      </div>
      <button class="btn primary" data-act="pickDone" id="pickBtn">Готово</button>
    `);
    const pin = $('#picker');
    $('#pickerLabel').textContent = isTo ? 'Сюда' : 'Отсюда';
    pin.classList.toggle('from', !isTo);
    pin.hidden = false;
    setTimeout(() => { // после отрисовки шторки — чтобы знать её высоту
      placePin();
      // приближаем карту, чтобы точнее целиться: к текущей точке, к «откуда» или к центру
      const start = (S[S.field] && S[S.field].ll) || (S.from && S.from.ll) || GIR.config.MAP_CENTER;
      GIR.mapView.placeUnder(start, ...pinXY(), 14); // карта отдаляется, чтобы был виден район вокруг
    }, 30);
    GIR.mapView.onMove(
      () => { pin.classList.add('lift'); $('#pickTitle').textContent = '…'; },
      () => { pin.classList.remove('lift'); resolvePin(); }
    );
  }

  /** Что под булавкой: координаты сразу, адрес — с небольшой задержкой. */
  function resolvePin() {
    const ll = GIR.mapView.latLngAt(...pinXY());
    picked = { ll, place: null };
    clearTimeout(geoTimer);
    geoTimer = setTimeout(async () => {
      const p = await GIR.geocoder.reverse(ll);
      if (p === undefined || !picked || picked.ll !== ll) return; // уже двинули карту дальше
      picked.place = p;
      const t = $('#pickTitle'), s = $('#pickSub');
      if (t) t.textContent = p ? p.n : 'Точка на карте';
      if (s) s.textContent = p ? p.s : ll[0].toFixed(5) + ', ' + ll[1].toFixed(5);
    }, 250);
  }

  function endPick() {
    $('#picker').hidden = true;
    GIR.mapView.onMove(null);
    S.pick = null;
  }

  function pickDone() {
    if (!picked) return;
    const field = S.pick;
    const p = picked.place;
    S[field] = { id: 'pt' + Date.now(), n: p ? p.n : 'Точка на карте', s: p ? p.s : '', ll: picked.ll, ic: 'pin' };
    endPick();
    if (field === 'from') show('to');
    else if (S.from) GIR.screens.route.show();
    else show('from');
  }

  /* клик по карте в режиме выбора — подводим точку под булавку */
  function mapClick(ll) {
    if (S.view === 'pick') GIR.mapView.placeUnder(ll, ...pinXY());
  }

  addEventListener('resize', () => { if (S.view === 'pick') placePin(); });

  GIR.screens.search = { show, mapClick, category };
  Object.assign(GIR.actions, {
    search: show,
    searchFrom: () => show('from'),
    searchTo: () => show('to'),
    // назад из поиска — на главный (маршрут ведёт «назад» тоже на главный, поэтому круга нет)
    searchBack: () => GIR.screens.home.show(),
    clearQuery() { const q = $('#q'); q.value = ''; onInput(''); q.focus(); },
    choose,
    category,
    catBack() { GIR.mapView.clearPois(); GIR.screens.home.show(); },
    pickOnMap,
    pickDone,
    pickCancel() { const f = S.pick; endPick(); show(f); }
  });
})();
