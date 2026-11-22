/* Главный экран.
   Видно сразу: поиск, мои места, категории «куда поехать» (кафе, рестораны, парки…).
   Свайп вверх: ближайший шлюз, подписка, шлюзы рядом, состояние сети, бонусы, статистика месяца. */
(function () {
  const S = GIR.state, C = GIR.config, F = GIR.fmt, I = GIR.I, esc = GIR.esc, geo = GIR.geo, N = GIR.net.nodes;

  function nearestGates(n) {
    const me = GIR.location.ll;
    return Object.keys(N).map((k) => ({ k, d: geo.hav(me, N[k].ll) })).sort((a, b) => a.d - b.d).slice(0, n);
  }

  function show() {
    S.view = 'home';
    S.route = null;
    S.pick = null;
    document.getElementById('picker').hidden = true;
    GIR.screens.ride.hideNav();
    GIR.mapView.clearRoute();
    GIR.mapView.clearPois();

    const P = GIR.data.places;
    const me = GIR.location.ll;
    const saved = [
      { id: 'home', t: 'Дом', ic: 'home', color: '#4A5060' },
      { id: 'bmstu', t: 'Учёба', ic: 'edu', color: '#3B6FE0' },
      { id: 'gorky', t: 'Парк Горького', ic: 'park', color: '#20A464' }
    ].map((s) => Object.assign(s, { d: geo.hav(me, P.find((p) => p.id === s.id).ll) }));

    const near = nearestGates(3);
    const g0 = near[0];
    const sub = GIR.subActive();
    const now = new Date();
    const month = S.trips.filter((t) => { const d = new Date(t.d); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const monthKm = month.reduce((s, t) => s + (t.corKm || 0), 0);

    const row = (act, arg, ico, color, title, sub2, meta) => `
      <button class="item" data-act="${act}" ${arg ? `data-arg="${arg}"` : ''}>
        <span class="item-ico tint" style="${color ? `--c:${color}` : ''}">${ico}</span>
        <div><b>${title}</b>${sub2 ? `<span>${sub2}</span>` : ''}</div>
        ${meta ? `<span class="item-meta">${meta}</span>` : ''}
      </button>`;

    GIR.ui.sheet.set(`
      <div id="homePeek">
        <div class="home-search">
          <button class="search-btn" data-act="search" data-arg="to">${I.search}<span>Куда поедем?</span></button>
          <button class="search-map" data-act="pickTo" aria-label="Выбрать на карте">${I.map}</button>
        </div>

        <div class="saved">
          ${saved.map((s) => `
            <button class="saved-item" data-act="quickTo" data-arg="${s.id}">
              <span class="saved-ico" style="--c:${s.color}">${I[s.ic]}</span>
              <span class="saved-txt"><b>${s.t}</b><span>${F.km(s.d)}</span></span>
            </button>`).join('')}
        </div>

        <div class="cats">
          ${GIR.data.categories.map((c) => `
            <button class="cat" data-act="category" data-arg="${c.id}">
              <span class="cat-ico" style="--c:${c.color}">${I[c.ic]}</span>${c.n}
            </button>`).join('')}
        </div>
      </div>

      <div class="home-more">
        <button class="hero" data-act="nearGate" data-arg="${g0.k}">
          <span class="hero-ico">${I.gate}</span>
          <span class="hero-txt"><span>Ближайший шлюз · ${F.km(g0.d)}</span><b>«${N[g0.k].n}»</b></span>
          <span class="hero-go">Маршрут ${I.chevron}</span>
        </button>

        <button class="sub-card ${sub ? 'on' : ''}" data-act="openSub">
          <span class="sub-ico">${I.crown}</span>
          <span class="sub-txt"><b>${sub ? 'Подписка активна' : 'Подписка ' + C.PRICE_SUB + ' ₽ / месяц'}</b>
            <span>${sub ? 'Безлимитный въезд до ' + F.date(new Date(S.sub.until)) : 'Безлимитный въезд во все коридоры'}</span></span>
          ${I.chevron}
        </button>

        <div class="block-title">Шлюзы рядом</div>
        <div class="list card-list">
          ${near.map((g) => row('nearGate', g.k, N[g.k].hub ? I.wrench : I.gate, N[g.k].hub ? '#4A5060' : '#E4002B',
            '«' + N[g.k].n + '»', N[g.k].hub ? 'SOS-хаб с механиком' : '', F.km(g.d))).join('')}
        </div>

        <div class="block-title">Сеть сегодня</div>
        <button class="status-card" data-act="lines">
          <span class="status-dot"></span>
          <span><b>Снег убран, покрытие сухое</b><span>${Object.keys(N).length} шлюзов · ${GIR.net.hubs.length} SOS-хабов · ${Math.round(GIR.net.totalKm())} км коридоров</span></span>
          ${I.chevron}
        </button>

        <div class="promo-row">
          <button class="promo" data-act="invite" style="--c:#E4002B">
            ${I.gift}<b>Пригласи друга</b><span>+3 въезда вам и другу</span>
          </button>
          <button class="promo" data-act="corporate" style="--c:#0FA3A3">
            ${I.city}<b>Для компаний</b><span>800 ₽ за сотрудника</span>
          </button>
        </div>

        <div class="month">
          <div><b>${month.length}</b><span>${F.plural(month.length, 'поездка', 'поездки', 'поездок')} в ${['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'][now.getMonth()]}</span></div>
          <div><b>${monthKm.toFixed(1).replace('.', ',')} км</b><span>по коридорам без машин</span></div>
        </div>
      </div>
    `, { peek: '.home-search' }); // на телефоне сначала видно только «Куда поедем?», остальное — свайпом вверх
    GIR.mapView.fly(C.MAP_CENTER, GIR.ui.isDesk() ? 13.3 : 12.4);
  }

  GIR.screens.home = { show };
  Object.assign(GIR.actions, {
    home: show,
    quickTo(id) {
      S.to = GIR.data.places.find((p) => p.id === id);
      GIR.screens.route.show();
    },
    nearGate(k) {
      S.to = { id: 'gate-' + k, n: 'Шлюз «' + N[k].n + '»', s: N[k].hub ? 'Шлюз и SOS-хаб' : 'Шлюз', ll: N[k].ll, ic: 'pin' };
      GIR.screens.route.show();
    },
    pickTo() { S.field = 'to'; GIR.actions.pickOnMap(); },
    addPlace() { GIR.ui.toast('Сохранение своих мест появится в следующей версии'); }
  });
})();
