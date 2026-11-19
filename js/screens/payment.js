/* Оплата (демо): разовый въезд, подписка, способы оплаты. Деньги не списываются. */
(function () {
  const S = GIR.state, C = GIR.config, F = GIR.fmt, I = GIR.I, $ = GIR.$;

  let paying = false;
  function process(amount, title, onDone) {
    if (paying) return; // двойное нажатие на «Оплатить»
    paying = true;
    GIR.ui.modal.open(`<div class="center"><div class="spinner"></div><h2 class="title">Оплата ${amount} ₽</h2><p class="lead">${title}</p></div>`);
    setTimeout(() => {
      if (!$('#modal').classList.contains('show')) { paying = false; GIR.ui.toast('Оплата отменена'); return; }
      $('#modal').innerHTML = `<div class="center"><div class="done-ico">${I.check}</div><h2 class="title">Оплачено</h2><p class="lead">${title}</p></div>`;
      setTimeout(() => { paying = false; GIR.ui.closeAll(); onDone(); }, 900);
    }, 1300);
  }

  function activateSub() {
    S.sub = { until: new Date(Date.now() + 30 * 864e5).toISOString() };
    GIR.store.set('sub', S.sub);
  }

  function payAndGo() {
    if (S.view !== 'route' || !S.route) return; // поездка уже идёт или маршрут не готов
    if (GIR.subActive()) return GIR.screens.ride.start(0);
    if (S.tariff === 'sub') {
      process(C.PRICE_SUB, 'Подписка Glasses in Red на 30 дней', () => { activateSub(); GIR.screens.ride.start(0); });
    } else {
      process(C.PRICE_SINGLE, `Разовый въезд · действует ${C.SINGLE_HOURS} часа`, () => GIR.screens.ride.start(C.PRICE_SINGLE));
    }
  }

  function payMethods() {
    const row = (id, title, sub, cls) => `
      <button class="item" data-act="setPay" data-arg="${id}">
        <span class="pm-ico ${cls}"></span><div><b>${title}</b><span>${sub}</span></div>
        <span class="item-meta">${S.pay === id ? '✓' : ''}</span>
      </button>`;
    GIR.ui.modal.open(`<h2 class="title">Способ оплаты</h2><p class="lead">Демо-режим: деньги не списываются.</p>
      ${row('card', 'Карта •••• 2741', 'Основная', '')}${row('sbp', 'СБП', 'Оплата через банк', 'sbp')}`);
  }

  function setPay(p) {
    S.pay = p;
    GIR.store.set('pay', p);
    GIR.ui.closeAll();
    if (S.view === 'route') GIR.screens.route.render();
  }

  function refresh() {
    if (S.view === 'home') GIR.screens.home.show();
    else if (S.view === 'route' && S.route) GIR.screens.route.render();
  }

  function openSub() {
    GIR.ui.closeAll();
    const on = GIR.subActive();
    GIR.ui.modal.open(on ? `
      <h2 class="title">Подписка</h2>
      <p class="lead">Действует до ${F.date(new Date(S.sub.until))}. Въезд во все коридоры без доплат.</p>
      <button class="btn ghost" data-act="cancelSub">Отменить подписку</button>
    ` : `
      <h2 class="title">Подписка</h2>
      <div class="plan-price">${C.PRICE_SUB} ₽ <small>в месяц</small></div>
      <p class="lead">Въезд во все коридоры без доплат. Разовый въезд — ${C.PRICE_SINGLE} ₽, так что подписка окупается с 17-й поездки.</p>
      <button class="btn primary" data-act="buySub">Оформить</button>
      <p class="hint">Демо: деньги не списываются</p>
    `);
  }

  function buySub() {
    process(C.PRICE_SUB, 'Подписка Glasses in Red на 30 дней', () => {
      activateSub();
      if (S.view === 'route') S.tariff = 'sub';
      GIR.ui.toast('Подписка активна до ' + F.date(new Date(S.sub.until)));
      refresh();
    });
  }

  function cancelSub() {
    S.sub = null;
    GIR.store.set('sub', null);
    GIR.ui.closeAll();
    GIR.ui.toast('Подписка отменена');
    S.tariff = 'single';
    refresh();
  }

  GIR.pay = { process, activateSub };
  Object.assign(GIR.actions, { payAndGo, payMethods, setPay, openSub, buySub, cancelSub });
})();
