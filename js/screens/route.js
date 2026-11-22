/* Экран маршрута: время, путь (дорога / коридор / дорога), тариф и кнопка. Ничего лишнего. */
(function () {
  const S = GIR.state, C = GIR.config, F = GIR.fmt, I = GIR.I, esc = GIR.esc, N = GIR.net.nodes;
  let seq = 0;

  async function show() {
    S.view = 'route';
    const token = ++seq;
    GIR.mapView.clearRoute();
    GIR.ui.sheet.set(`
      <button class="back" data-act="home" data-fast>${I.back}<span>${esc(S.to.n)}</span></button>
      <div class="loading"><div class="spinner"></div><span>Строим маршрут…</span></div>
    `);
    await GIR.netReady;
    const r = await GIR.planner.build(S.from, S.to);
    if (token !== seq || S.view !== 'route') return;
    S.route = r;
    if (GIR.subActive()) S.tariff = 'sub';
    GIR.mapView.drawRoute(r);
    render();
    setTimeout(() => GIR.mapView.fit(r.coords), 60);
  }

  function render() {
    const r = S.route, sub = GIR.subActive();
    const arrive = F.clock(new Date(Date.now() + r.totalMin * 60000));
    const head = `
      <button class="back" data-act="home" data-fast>${I.back}<span>${esc(S.to.n)}</span></button>
      <div class="sum"><b>${F.min(r.totalMin)}</b><span>${F.km(r.totalKm)} · прибытие в ${arrive}</span></div>`;

    if (r.none) {
      GIR.ui.sheet.set(`${head}
        <p class="lead">Красных коридоров по пути нет. Поведём по обычным улицам.</p>
        <button class="btn primary road" data-act="roadOnly">Поехали</button>`);
      return;
    }

    const c = r.corridor;
    const price = S.tariff === 'single' ? C.PRICE_SINGLE : C.PRICE_SUB;

    GIR.ui.sheet.set(`${head}
      ${GIR.ui.timeline(r)}
      <div class="sum-note"><i class="sw sw-cor"></i>${F.km(c.km)} по коридору · «${N[c.gates[0]].n}» → «${N[c.gates[c.gates.length - 1]].n}»</div>
      ${r.approx ? '<div class="note">Нет связи с сервером маршрутов. Улицы показаны примерно.</div>' : ''}

      ${sub ? '' : `
        <div class="seg seg-slide ${S.tariff === 'sub' ? 'right' : ''}" id="tariffSeg"><i class="seg-thumb"></i>
          <button class="${S.tariff === 'single' ? 'on' : ''}" data-act="tariff" data-arg="single"><b>${C.PRICE_SINGLE} ₽</b><span>разовый въезд</span></button>
          <button class="${S.tariff === 'sub' ? 'on' : ''}" data-act="tariff" data-arg="sub"><b>${C.PRICE_SUB} ₽</b><span>месяц без лимита</span></button>
        </div>
        <button class="paymethod" data-act="payMethods"><i class="pm-ico ${S.pay === 'sbp' ? 'sbp' : ''}"></i><span>${S.pay === 'sbp' ? 'СБП' : 'Карта •••• 2741'}</span><em>›</em></button>`}

      <button class="btn primary" data-act="payAndGo" id="payBtn">${sub ? 'Поехали' : 'Оплатить ' + price + ' ₽'}</button>
    `);
  }

  /** Вернуться к уже построенному маршруту без повторного запроса. */
  function restore() {
    S.view = 'route';
    GIR.mapView.drawRoute(S.route);
    render();
    setTimeout(() => GIR.mapView.fit(S.route.coords), 60);
  }

  GIR.screens.route = { show, render, restore };
  Object.assign(GIR.actions, {
    // переключение тарифа без перерисовки шторки: ползунок съезжает, меняется только сумма на кнопке
    tariff(t) {
      if (S.tariff === t) return;
      S.tariff = t;
      const seg = document.getElementById('tariffSeg');
      if (!seg) { render(); return; }
      seg.classList.toggle('right', t === 'sub');
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.arg === t));
      document.getElementById('payBtn').textContent = 'Оплатить ' + (t === 'sub' ? C.PRICE_SUB : C.PRICE_SINGLE) + ' ₽';
    },
    roadOnly() { GIR.screens.ride.start(0); }
  });
})();
