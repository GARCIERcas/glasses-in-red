/* Поездка: симуляция движения, пошаговая навигация, переключение «коридор ↔ дорога». */
(function () {
  const S = GIR.state, C = GIR.config, F = GIR.fmt, I = GIR.I, $ = GIR.$, esc = GIR.esc;
  const geo = GIR.geo, mv = GIR.mapView, net = GIR.net, P = GIR.planner;

  S.simSpeed = GIR.store.get('simSpeed', 1);

  /* баннер навигации: двойной тап — свернуть в маленький прямоугольник (стрелка + расстояние) и обратно */
  const navEl = document.getElementById('nav');
  navEl.classList.toggle('compact', !!GIR.store.get('navCompact', false));
  navEl.title = 'Двойной тап — свернуть или развернуть';
  let lastTap = 0;
  navEl.addEventListener('click', () => {
    const t = performance.now();
    if (t - lastTap < 350) {
      const on = !navEl.classList.contains('compact');
      navEl.classList.toggle('compact', on);
      GIR.store.set('navCompact', on);
      lastTap = 0;
    } else lastTap = t;
  });

  /* ---------- цикл: requestAnimationFrame для плавности + страховочный таймер для фоновой вкладки ---------- */
  let rafId = 0, ivId = 0, lastTick = 0;
  function run() {
    if (rafId || ivId) return;
    const frame = (t) => { rafId = requestAnimationFrame(frame); loop(t); };
    rafId = requestAnimationFrame(frame);
    ivId = setInterval(() => { const t = performance.now(); if (t - lastTick > 90) loop(t); }, 50);
  }
  function halt() {
    cancelAnimationFrame(rafId);
    clearInterval(ivId);
    rafId = ivId = 0;
  }

  /* ---------- старт ---------- */
  function start(price) {
    const r = S.route;
    S.ride = {
      price, km: 0, paused: false, busy: false, sos: 0,
      gateIn: !r.corridor, gateOut: !r.corridor,
      mode: null, iconKey: '', heading: null, lastDone: 0,
      t: performance.now(),
      startTime: Date.now(), // часы симуляции: прибытие = старт + пройденные минуты + оставшиеся
      simMin: 0
    };
    setSpeeds();
    S.view = 'ride';
    S.follow = true;
    const p = geo.pointAt(r.coords, r.cum, 0);
    mv.riderAt(p.ll, p.heading);
    mv.follow(p.ll, C.RIDE_ZOOM, true);
    $('#nav').hidden = false;
    document.body.classList.add('riding');
    mv.showMe(false); // вместо точки «я здесь» — велосипедист
    render();
    run();
  }

  function setSpeeds() {
    const R = S.ride;
    R.vCor = C.SIM_COR_KMPS;
    R.vRoad = C.SIM_ROAD_KMPS;
  }

  /* ---------- шаг симуляции ---------- */
  function loop(now) {
    lastTick = now;
    const R = S.ride;
    if (!R || !['ride', 'gate', 'sos'].includes(S.view)) { halt(); return; }
    const r = S.route;
    const dt = Math.min(0.1, (now - R.t) / 1000);
    R.t = now;

    if (!R.paused && !R.busy && !R.userPaused) {
      const leg = P.legAt(r, R.km);
      const v = (leg.type === 'corridor' && R.gateIn ? R.vCor : R.vRoad) * S.simSpeed;
      const step = Math.min(v * dt, r.totalKm - R.km);
      R.km += step;
      R.simMin += leg.km > 0 ? step * (leg.min / leg.km) : 0;

      const c = r.corridor;
      if (c && !R.gateIn && R.km >= c.startKm) {
        R.km = c.startKm;
        R.paused = true;
        GIR.screens.gate.show();
      }
      if (c && R.gateIn && !R.gateOut && R.km >= c.endKm) {
        R.gateOut = true;
        GIR.ui.toast(`Выезд через шлюз «${net.nodes[c.gates[c.gates.length - 1]].n}». Дальше — по улицам`, 3500);
      }
      if (R.km >= r.totalKm - 1e-6) {
        R.km = r.totalKm;
        update(now);
        halt();
        GIR.screens.finish.show(false);
        return;
      }
    }
    update(now);
  }

  /* ---------- обновление карты, баннера, панели ---------- */
  function currentLine(r, km) {
    const c = r.corridor;
    if (!c) return null;
    const local = km - c.startKm;
    let j = 0;
    while (j < c.nodeKms.length - 2 && c.nodeKms[j + 1] <= local) j++;
    return net.lines[net.lineOf(c.gates[j], c.gates[j + 1])];
  }

  function update(now) {
    const R = S.ride, r = S.route;
    if (!R) return;
    now = now || performance.now();

    // позиция и сглаженный курс (смотрим на 40 м вперёд, чтобы стрелка не дёргалась на изломах)
    const p = geo.pointAt(r.coords, r.cum, R.km);
    const ahead = geo.pointAt(r.coords, r.cum, Math.min(r.totalKm, R.km + 0.04)).ll;
    const target = geo.hav(p.ll, ahead) > 0.002 ? geo.bearing(p.ll, ahead) : p.heading;
    if (R.heading === null) R.heading = target;
    const diff = ((target - R.heading + 540) % 360) - 180;
    R.heading = (R.heading + diff * 0.15 + 360) % 360;
    // в режиме слежения: велосипедист стоит в одной точке экрана, а карта каждый кадр сдвигается под ним
    // (follow сам пропускает кадр, если сдвиг меньше пикселя)
    const following = S.follow && S.view === 'ride';
    if (following) mv.follow(p.ll, null, true);
    mv.riderAt(p.ll, R.heading, following);
    if (now - R.lastDone > 120) { R.lastDone = now; mv.setDone(geo.sliceTo(r.coords, r.cum, R.km)); }

    const leg = P.legAt(r, R.km);
    const mode = leg.type === 'corridor' && R.gateIn && !R.gateOut ? 'corridor' : 'road';
    if (mode !== R.mode) {
      R.mode = mode;
      const nav = $('#nav');
      nav.classList.remove('corridor', 'road');
      nav.classList.add(mode);
      const lb = $('#leaveBtn');
      if (lb) lb.hidden = mode !== 'corridor';
    }

    // баннер
    let modeText;
    if (mode === 'corridor') {
      const line = currentLine(r, R.km);
      modeText = 'Красный коридор' + (line ? ' · ' + line.name : '');
    } else if (r.corridor && !R.gateIn) {
      modeText = 'Улицы · до шлюза «' + net.nodes[r.corridor.gates[0]].n + '»';
    } else {
      modeText = 'Улицы';
    }
    $('#navMode').textContent = R.userPaused ? 'Пауза · ' + modeText : modeText;

    const lookAhead = R.paused ? -0.002 : 0.003; // стоим у шлюза — показываем сам шлюз
    const i = r.steps.findIndex((s) => s.km > R.km + lookAhead);
    const st = r.steps[i < 0 ? r.steps.length - 1 : i];
    const nx = i < 0 ? null : r.steps[i + 1];
    const key = st.kind + (st.mod || '');
    if (key !== R.iconKey) {
      R.iconKey = key;
      const ni = $('#navIco');
      ni.innerHTML = GIR.maneuverIcon(st.kind, st.mod);
      ni.classList.remove('bump'); void ni.offsetWidth; ni.classList.add('bump'); // новый манёвр — иконка «подпрыгивает»
    }
    announce(st, st.km - R.km);
    $('#navDist').textContent = F.dist(Math.max(0, st.km - R.km));
    $('#navInstr').textContent = st.text;
    $('#navStreet').textContent = st.street || '';
    const then = $('#navThen');
    const thenKey = nx ? nx.km + nx.text : '';
    if (then.dataset.k !== thenKey) {
      then.dataset.k = thenKey;
      then.hidden = !nx;
      if (nx) then.innerHTML = `<span>Затем</span>${GIR.maneuverIcon(nx.kind, nx.mod)}<span>${esc(nx.text)}</span>`;
    }

    // панель: прибытие стоит на месте, оставшееся время уменьшается
    if (!$('#rEta')) return;
    const leftMin = P.remainingMin(r, R.km);
    const pausedMs = R.userPaused ? Date.now() - R.pauseAt : 0; // на паузе прибытие «уезжает» вперёд
    $('#rEta').textContent = F.clock(new Date(R.startTime + pausedMs + (R.simMin + leftMin) * 60000));
    $('#rMin').textContent = F.min(leftMin);
    $('#rKm').textContent = F.km(Math.max(0.01, r.totalKm - R.km));
    const pos = GIR.ui.timelinePos(r, R.km);
    $('#tlPos').style.left = pos + '%';
    $('#tlDone').style.width = pos + '%';
  }

  /* голос и вибрация перед манёвром (настройки в меню) */
  function announce(st, distKm) {
    const R = S.ride, set = GIR.settings || {};
    const id = st.km.toFixed(3) + st.text;
    if (R.paused || distKm > 0.15 || R.spoken === id) return;
    R.spoken = id;
    if (set.vibro && navigator.vibrate) { try { navigator.vibrate(80); } catch (e) { /* нет поддержки */ } }
    if (set.voice && window.speechSynthesis) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(st.text.replace(/«|»/g, ''));
      u.lang = 'ru-RU';
      speechSynthesis.speak(u);
    }
  }

  function render() {
    const r = S.route, R = S.ride;
    S.view = 'ride';
    GIR.ui.sheet.set(`
      <div class="ride-top">
        <div class="ride-eta"><span>Прибытие</span><b id="rEta">--:--</b></div>
        <div class="ride-left"><b id="rMin">—</b><span id="rKm">—</span></div>
        <div class="ride-ctrl">
          <button class="ctrl ${R.userPaused ? 'on' : ''}" data-act="pauseRide" id="pauseBtn" aria-label="${R.userPaused ? 'Продолжить' : 'Пауза'}">${R.userPaused ? I.play : I.pause}</button>
          <button class="ctrl speed" data-act="speed" title="Скорость симуляции">×${S.simSpeed}</button>
        </div>
      </div>
      ${GIR.ui.timeline(r, true)}
      <div class="ride-actions">
        <button class="act act-sos" data-act="sos"><b>SOS</b><span>механик</span></button>
        ${r.corridor ? `<button class="act" data-act="leave" id="leaveBtn" hidden>${I.exit}<span>Сойти с коридора</span></button>` : ''}
        <button class="act" data-act="steps">${I.list}<span>Шаги</span></button>
      </div>
      <button class="link-btn" data-act="stopRide">Завершить поездку</button>
    `, { min: '#sheetBody > .tl', key: 'ride' }); // свайп вниз — остаются время, прибытие, пауза, скорость и полоса прогресса
    R.mode = null;
    $('#navThen').dataset.k = '-';
    update();
  }

  /* ---------- события ---------- */
  function gatePassed() {
    const R = S.ride;
    if (!R) return;
    R.gateIn = true;
    R.paused = false;
    R.t = performance.now();
    S.follow = true;
    render();
    mv.follow(mv.riderLL(), C.RIDE_ZOOM, true);
    run();
  }

  async function leave() {
    const R = S.ride;
    if (!R || R.mode !== 'corridor' || R.busy) return;
    R.busy = true;
    const btn = $('#leaveBtn');
    if (btn) btn.disabled = true;
    const name = await P.leave(S.route, R.km);
    R.busy = false;
    R.t = performance.now();
    if (!name) {
      GIR.ui.toast('Ближайший шлюз — и так выезд');
      if (btn) btn.disabled = false;
      return;
    }
    setSpeeds();
    mv.drawRoute(S.route);
    GIR.ui.toast(`Выезжаем через шлюз «${name}», дальше — по улицам`, 3000);
    render();
  }

  function speed() {
    const list = C.SIM_SPEEDS;
    S.simSpeed = list[(list.indexOf(S.simSpeed) + 1) % list.length];
    GIR.store.set('simSpeed', S.simSpeed);
    const b = document.querySelector('.speed');
    if (b) b.textContent = '×' + S.simSpeed;
  }

  function steps() {
    const R = S.ride, r = S.route;
    GIR.ui.modal.open(`
      <h2 class="title">Шаги маршрута</h2>
      <div class="steps">
        ${r.steps.filter((s) => s.km >= R.km - 0.003).map((s) => `
          <div class="step">
            <span class="step-ico ${s.type}">${GIR.maneuverIcon(s.kind, s.mod)}</span>
            <div><b>${esc(s.text)}</b>${s.street ? `<span>${esc(s.street)}</span>` : ''}</div>
            <em>${F.dist(Math.max(0, s.km - R.km))}</em>
          </div>`).join('')}
      </div>`);
  }

  function stopRide() {
    GIR.ui.modal.open(`
      <h2 class="title">Завершить поездку?</h2>
      <p class="lead">Билет действует ${C.SINGLE_HOURS} часа — в коридор можно вернуться.</p>
      <button class="btn primary" data-act="stopConfirm">Завершить</button>
      <div class="btn-row"><button class="btn ghost" data-act="closeAll">Продолжить</button></div>`);
  }

  function hideNav() {
    $('#nav').hidden = true;
    $('#nav').classList.remove('paused');
    document.body.classList.remove('riding');
    mv.showMe(true);
  }

  /** Продолжить после паузы (SOS). */
  function resume() {
    const R = S.ride, c = S.route.corridor;
    if (c && !R.gateIn && R.km >= c.startKm) { GIR.screens.gate.show(); return; }
    render();
    run();
    // сначала камера плавно подлетает к велосипедисту на обычном зуме, потом включаем слежение и едем —
    // иначе слежение мгновенно перескакивало на новую точку и картинка дёргалась
    S.follow = false;
    requestAnimationFrame(() => {
      if (S.ride !== R) return;
      mv.follow(mv.riderLL(), C.RIDE_ZOOM);
      setTimeout(() => {
        if (S.ride !== R || S.view !== 'ride') return;
        R.paused = false;
        R.t = performance.now();
        S.follow = true;
      }, 380);
    });
  }

  /** Задержка в пути (ожидание механика) — сдвигает время прибытия. */
  function addDelay(min) { if (S.ride) S.ride.simMin += min; }

  GIR.screens.ride = { start, render, gatePassed, hideNav, resume, addDelay };
  Object.assign(GIR.actions, {
    leave, steps, stopRide, speed,
    stopConfirm() { GIR.ui.closeAll(); GIR.screens.finish.show(true); },
    /* пауза: велосипедист стоит, время прибытия сдвигается на время паузы */
    pauseRide() {
      const R = S.ride;
      if (!R) return;
      R.userPaused = !R.userPaused;
      if (R.userPaused) R.pauseAt = Date.now();
      else { R.startTime += Date.now() - (R.pauseAt || Date.now()); R.t = performance.now(); S.follow = true; }
      const b = $('#pauseBtn');
      if (b) {
        b.innerHTML = R.userPaused ? I.play : I.pause;
        b.classList.toggle('on', R.userPaused);
        b.setAttribute('aria-label', R.userPaused ? 'Продолжить' : 'Пауза');
      }
      $('#nav').classList.toggle('paused', R.userPaused);
      GIR.ui.toast(R.userPaused ? 'Поездка на паузе' : 'Едем дальше', 1500);
      update();
    }
  });
})();
