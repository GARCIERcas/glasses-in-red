/* Боковое меню и его страницы: поездки, места, подписка, оплата, сеть, друзья, компании, настройки, поддержка. */
(function () {
  const S = GIR.state, C = GIR.config, F = GIR.fmt, I = GIR.I, esc = GIR.esc, net = GIR.net;

  const settings = Object.assign({ voice: false, vibro: true }, GIR.store.get('settings', {}));
  GIR.settings = settings;

  function open() {
    const sub = GIR.subActive();
    const km = S.trips.reduce((s, t) => s + (t.corKm || 0), 0);
    const it = (act, ico, color, title, sub2) => `
      <button class="mi" data-act="${act}">
        <span class="mi-ico" style="--c:${color}">${ico}</span>
        <span class="mi-txt"><b>${title}</b>${sub2 ? `<span>${sub2}</span>` : ''}</span>
        ${I.chevron}
      </button>`;
    const group = (title, items) => `<div class="mgroup"><div class="mgroup-title">${title}</div><div class="mgroup-card">${items}</div></div>`;
    GIR.ui.drawer.open(`
      <div class="dhead">
        <div class="dhead-top">
          <span class="dhead-ava">${C.USER_NAME[0]}</span>
          <div><b>${C.USER_NAME}</b><span>${sub ? 'Подписка до ' + F.date(new Date(S.sub.until)) : 'Без подписки'}</span></div>
        </div>
        <div class="dhead-stats">
          <div><b>${S.trips.length}</b><span>${F.plural(S.trips.length, 'поездка', 'поездки', 'поездок')}</span></div>
          <div><b>${km.toFixed(1).replace('.', ',')}</b><span>км без машин</span></div>
          <div><b>${sub ? '∞' : '—'}</b><span>${sub ? 'безлимит' : 'нет подписки'}</span></div>
        </div>
      </div>
      ${group('Поездки',
        it('history', I.history, '#3B6FE0', 'Мои поездки', S.trips.length ? 'Последняя: ' + esc(S.trips[0].to) : 'Пока пусто') +
        it('places', I.home, '#20A464', 'Мои места', 'Дом, учёба'))}
      ${group('Оплата',
        it('openSub', I.crown, '#E4002B', 'Подписка', sub ? 'Активна' : C.PRICE_SUB + ' ₽ в месяц') +
        it('payMethods', I.card, '#6B4CE6', 'Способ оплаты', S.pay === 'sbp' ? 'СБП' : 'Карта •••• 2741') +
        it('invite', I.gift, '#F08A24', 'Пригласить друга', '+3 въезда в подарок'))}
      ${group('Сеть',
        it('lines', I.map, '#E4002B', 'Состояние коридоров', '') +
        it('corporate', I.city, '#0FA3A3', 'Для компаний', ''))}
      ${group('Ещё',
        it('settings', I.gear, '#6E737B', 'Настройки', '') +
        it('support', I.help, '#D0368A', 'Поддержка', '') +
        it('about', I.info, '#4A5060', 'Как это работает', ''))}
    `);
  }

  function history() {
    GIR.ui.closeAll();
    GIR.ui.modal.open(`<h2 class="title">Мои поездки</h2>
      ${S.trips.length ? S.trips.map((t) => `
        <div class="trip">
          <b>${esc(t.to)}</b>
          <span>${new Date(t.d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${t.min} мин · ${t.price ? t.price + ' ₽' : 'подписка'}</span>
        </div>`).join('') : '<div class="empty">Поездок пока нет</div>'}`);
  }

  function places() {
    GIR.ui.closeAll();
    GIR.ui.modal.open(`<h2 class="title">Мои места</h2>
      <button class="item" data-act="placeGo" data-arg="home"><span class="item-ico">${I.home}</span><div><b>Дом</b><span>Таганская улица, 24</span></div><span class="item-meta">›</span></button>
      <button class="item" data-act="placeGo" data-arg="bmstu"><span class="item-ico">${I.edu}</span><div><b>Учёба</b><span>МГТУ им. Баумана</span></div><span class="item-meta">›</span></button>
      <button class="item" data-act="addPlace"><span class="item-ico">${I.pin}</span><div><b>Добавить место</b><span>Работа, спортзал, друзья</span></div></button>`);
  }

  /* условные статусы уборки — стабильные для каждого коридора */
  function lineStatus(id) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return { min: 5 + (h % 30), work: id === 'BK' };
  }

  function lines() {
    GIR.ui.closeAll();
    GIR.ui.modal.open(`<h2 class="title">Состояние коридоров</h2>
      <p class="lead">Уборка запускается автоматически после снега и дождя.</p>
      ${Object.entries(net.lines).map(([id, l]) => {
        const s = lineStatus(id);
        return `<div class="line-row"><i class="line-sw"></i>
          <div><b>${l.name}</b><span>${F.km(net.lineKm(id))} · ${l.chain.length} ${F.plural(l.chain.length, 'шлюз', 'шлюза', 'шлюзов')} · убрано ${s.min} мин назад</span></div>
          <span class="badge ${s.work ? 'warn' : 'ok'}">${s.work ? 'уборка' : 'чисто'}</span></div>`;
      }).join('')}`);
  }

  function invite() {
    GIR.ui.closeAll();
    const code = 'RED-' + C.USER_NAME.toUpperCase().replace(/[^A-ZА-ЯЁ]/g, '').slice(0, 5) + '7';
    GIR.ui.modal.open(`<h2 class="title">Пригласите друга</h2>
      <p class="lead">Друг получит 3 бесплатных въезда, а вы ещё 3, когда он прокатится первый раз.</p>
      <div class="promo-code"><b>${code}</b><button class="btn ghost" data-act="copyCode" data-arg="${code}">Скопировать</button></div>
      <button class="btn primary" data-act="shareCode" data-arg="${code}">Поделиться</button>`);
  }

  function corporate() {
    GIR.ui.closeAll();
    GIR.ui.modal.open(`<h2 class="title">Для компаний</h2>
      <div class="plan-price">800 ₽ <small>в месяц за сотрудника</small></div>
      <ul class="bullets">
        <li>Безлимитный въезд во все коридоры</li>
        <li>Приоритетный SOS-механик</li>
        <li>Отчёт для HR и wellness-программ</li>
      </ul>
      <button class="btn primary" data-act="corpRequest">Оставить заявку</button>`);
  }

  function settingsPage() {
    GIR.ui.closeAll();
    const row = (key, title, sub) => `
      <label class="switch-row"><div><b>${title}</b><span>${sub}</span></div>
        <input type="checkbox" data-setting="${key}" ${settings[key] ? 'checked' : ''}><i class="switch"></i></label>`;
    GIR.ui.modal.open(`<h2 class="title">Настройки</h2>
      ${row('voice', 'Голосовые подсказки', 'Озвучивать повороты и шлюзы в поездке')}
      ${row('vibro', 'Вибрация перед манёвром', 'На телефоне, перед поворотом и шлюзом')}`);
    document.querySelectorAll('[data-setting]').forEach((el) => el.addEventListener('change', () => {
      settings[el.dataset.setting] = el.checked;
      GIR.store.set('settings', settings);
    }));
  }

  function support() {
    GIR.ui.closeAll();
    const q = (t, a) => `<details class="faq"><summary>${t}</summary><p>${a}</p></details>`;
    GIR.ui.modal.open(`<h2 class="title">Поддержка</h2>
      ${q('Шлюз не открывается', 'Поднесите телефон ближе к считывателю и проверьте, что билет или подписка активны. Если не помогло, напишите нам: откроем удалённо.')}
      ${q('Что если сломался велосипед?', 'Нажмите SOS в поездке, и механик ближайшего хаба приедет по коридору. Это бесплатно.')}
      ${q('Как вернуть деньги за въезд?', 'Если вы не проехали через шлюз, деньги вернутся автоматически в течение суток.')}
      ${q('Сколько действует разовый билет?', `${C.SINGLE_HOURS} часа с момента оплаты во всех коридорах.`)}
      <button class="btn primary" data-act="supportChat">Написать в поддержку</button>
      <p class="hint">Если есть травма или угроза жизни, звоните 112</p>`);
  }

  function about() {
    GIR.ui.closeAll();
    GIR.ui.modal.open(`<h2 class="title">Как это работает</h2>
      <ol class="how">
        <li><b>Выберите, куда ехать</b><span>Маршрут пройдёт по красным коридорам, без машин и светофоров</span></li>
        <li><b>Приложите телефон к шлюзу</b><span>${C.PRICE_SINGLE} ₽ за въезд или ${C.PRICE_SUB} ₽ в месяц</span></li>
        <li><b>Что-то сломалось? Нажмите SOS</b><span>Механик приедет по коридору</span></li>
      </ol>
      <button class="btn dark" data-act="closeAll">Понятно</button>
      <button class="link-btn" data-act="resetDemo">Сбросить демо-данные</button>`);
  }

  function resetDemo() {
    S.sub = null;
    S.trips = [];
    GIR.store.set('sub', null);
    GIR.store.set('trips', []);
    GIR.ui.closeAll();
    if (!S.ride) GIR.screens.home.show();
    GIR.ui.toast('Демо-данные сброшены');
  }

  Object.assign(GIR.actions, {
    menu: open, history, places, lines, invite, corporate, settings: settingsPage, support, about, resetDemo,
    placeGo(id) { GIR.ui.closeAll(); GIR.actions.quickTo(id); },
    async copyCode(code) {
      try { await navigator.clipboard.writeText(code); GIR.ui.toast('Код скопирован'); }
      catch (e) { GIR.ui.toast('Код: ' + code); }
    },
    async shareCode(code) {
      const text = `Катаюсь по красным коридорам Glasses in Red, без машин и светофоров. Промокод ${code} даёт 3 бесплатных въезда.`;
      if (navigator.share) { try { await navigator.share({ text }); } catch (e) { /* отменили */ } }
      else GIR.actions.copyCode(code);
    },
    corpRequest() { GIR.ui.closeAll(); GIR.ui.toast('Заявка отправлена. Менеджер свяжется с вами (демо)'); },
    supportChat() { GIR.ui.closeAll(); GIR.ui.toast('Чат поддержки откроется в следующей версии (демо)'); }
  });
})();
