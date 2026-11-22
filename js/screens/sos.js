/* SOS: выбор проблемы → механик ближайшего хаба едет к вам → ремонт. */
(function () {
  const S = GIR.state, C = GIR.config, F = GIR.fmt, I = GIR.I, $ = GIR.$, geo = GIR.geo, net = GIR.net;
  const MECHANICS = ['Артём', 'Ильдар', 'Марина', 'Сергей'];
  const ISSUES = {
    tire: { title: 'Прокол колеса', job: 'замена камеры', ic: 'tire' },
    chain: { title: 'Слетела цепь', job: 'установка цепи', ic: 'chain' },
    brake: { title: 'Не работают тормоза', job: 'регулировка тормозов', ic: 'brake' },
    fall: { title: 'Упал, нужна помощь', job: 'осмотр и помощь', ic: 'help' }
  };

  function open() {
    const R = S.ride;
    if (!R) return;
    R.paused = true;
    S.view = 'sos';
    GIR.ui.sheet.set(`
      <button class="back" data-act="sosCancel">${I.back}<span>Отмена</span></button>
      <h2 class="title">Что случилось?</h2>
      <p class="lead">Механик ближайшего хаба приедет бесплатно.</p>
      <div class="issues">
        ${Object.entries(ISSUES).map(([id, x]) => `<button class="issue" data-act="sosSend" data-arg="${id}">${I[x.ic]}<span>${x.title}</span></button>`).join('')}
      </div>
      <div class="note warn">Если есть травма или угроза жизни, сразу звоните 112.</div>
    `);
  }

  function send(id) {
    const issue = ISSUES[id];
    const R = S.ride;
    R.sos++;
    const here = GIR.mapView.riderLL();
    const hub = net.hubs.map((k) => ({ k, d: geo.hav(net.nodes[k].ll, here) })).sort((a, b) => a.d - b.d)[0];
    const from = net.nodes[hub.k].ll;
    const name = MECHANICS[Math.floor(Math.random() * MECHANICS.length)];
    const eta = Math.max(3, Math.round((hub.d / 25) * 60) + 2);
    GIR.screens.ride.addDelay(eta + 7); // ожидание и ремонт сдвигают прибытие

    GIR.mapView.mechShow(from, here);
    S.follow = false;

    GIR.ui.sheet.set(`
      <span class="badge cor">SOS · ${issue.title}</span>
      <h2 class="title" id="mTitle">Механик выехал</h2>
      <div class="mech">
        <span class="mech-ava">${name[0]}</span>
        <div><b>${name}</b><span>SOS-хаб «${net.nodes[hub.k].n}» · ${F.km(hub.d)}</span></div>
        <div class="mech-eta"><b id="mEta">${eta} мин</b><span>в пути</span></div>
      </div>
      <div class="progress"><i id="mProg"></i></div>
      <p class="lead" id="mSub">Остановитесь у края коридора и подождите.</p>
      <div id="mActions"><button class="btn ghost" data-act="callMech">${I.phone}Позвонить механику</button></div>
    `);
    // камеру ставим после смены шторки: отступ снизу считается по её новой высоте
    requestAnimationFrame(() => { if (S.view === 'sos') GIR.mapView.fit([from, here]); });

    const t0 = performance.now(), D = C.MECH_MS || 6500;
    const iv = setInterval(() => step(performance.now()), 33);
    function step(now) {
      if (S.view !== 'sos') { clearInterval(iv); return; }
      const f = Math.min(1, (now - t0) / D);
      const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      GIR.mapView.mechMove([from[0] + (here[0] - from[0]) * e, from[1] + (here[1] - from[1]) * e], here);
      const pr = $('#mProg'), et = $('#mEta');
      if (pr) pr.style.width = f * 100 + '%';
      if (et) et.textContent = Math.max(0, Math.ceil(eta * (1 - f))) + ' мин';
      if (f < 1) return;
      clearInterval(iv);
      GIR.mapView.mechArrived();
      $('#mTitle').textContent = 'Механик на месте';
      $('#mSub').textContent = `${name} уже работает: ${issue.job}. Обычно это 5–10 минут.`;
      $('#mActions').innerHTML = '<button class="btn primary" data-act="sosDone">Всё починили, едем дальше</button>';
      // плавно возвращаем камеру к велосипедисту — туда же, где она будет держать его в поездке
      GIR.mapView.follow(here, C.RIDE_ZOOM);
    }
  }

  const clearMech = () => GIR.mapView.mechClear();

  GIR.screens.sos = { open };
  Object.assign(GIR.actions, {
    sos: open,
    sosSend: send,
    sosCancel() { clearMech(); GIR.screens.ride.resume(); },
    sosDone() { clearMech(); GIR.ui.toast('Хорошей дороги!'); GIR.screens.ride.resume(); },
    callMech() { GIR.ui.toast('Звоним механику… (демо)'); }
  });
})();
