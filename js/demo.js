/* Демо-режим для записи промо-ролика: откройте сайт с ?demo в адресе (например, …/glasses-in-red/?demo).
   Приложение само проходит сценарий: поиск → маршрут → тариф → оплата → QR и турникет → поездка → SOS → финиш.
   Нажатия показываются кружком, как в записи экрана. Данные (поездки, подписка) в демо не сохраняются. */
(function () {
  if (!/[?&#]demo\b/.test(location.search + location.hash)) return;

  const S = GIR.state, $ = GIR.$;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let stopped = false;

  /* ---------- подготовка: чистое состояние, ничего не пишем в память браузера ---------- */
  GIR.store.set = () => {};
  S.sub = null;
  S.tariff = 'single';
  S.simSpeed = 2;
  GIR.config.MECH_MS = 3200; // механик доезжает быстрее, чтобы не тянуть кадр
  if (GIR.settings) GIR.settings.voice = false;
  document.body.classList.add('demo');

  const style = document.createElement('style');
  style.textContent = `
    body.demo, body.demo * { cursor: none !important; }
    /* кольцо от нажатия */
    .demo-touch {
      position: fixed; z-index: 9998; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      border: 2px solid rgba(228, 0, 43, .75); background: rgba(228, 0, 43, .12); pointer-events: none;
      animation: demoTouch .6s cubic-bezier(.2, .8, .2, 1) forwards;
    }
    @keyframes demoTouch { 0% { transform: scale(.3); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }

    /* курсор: X и Y анимируются с разной кривой — путь получается плавной дугой, как у руки */
    .demo-cx, .demo-cy { position: fixed; left: 0; top: 0; z-index: 9999; pointer-events: none; will-change: transform; }
    .demo-cx { transition: transform var(--t, .7s) cubic-bezier(.45, 0, .2, 1); }
    .demo-cy { position: absolute; transition: transform var(--t, .7s) cubic-bezier(.25, .1, .25, 1); }
    .demo-cur { position: absolute; left: -4px; top: -3px; width: 30px; height: 30px; transform-origin: 4px 3px; transition: transform .14s ease, opacity .4s; filter: drop-shadow(0 3px 6px rgba(0, 0, 0, .28)); }
    .demo-cur.down { transform: scale(.82); }
    .demo-cur.off { opacity: 0; }
    .demo-cur svg { width: 100%; height: 100%; display: block; }
    .demo-press { transform: scale(.96) !important; transition: transform .12s !important; }
    .demo-start {
      position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; text-align: center;
      background: rgba(255, 255, 255, .78); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
      font-family: var(--font); color: var(--ink); transition: opacity .5s; cursor: pointer !important;
    }
    .demo-start.hide { opacity: 0; pointer-events: none; }
    .demo-start b { display: inline-flex; align-items: center; gap: 10px; padding: 16px 28px; border-radius: 999px; background: var(--red); color: #fff; font-size: 18px; font-weight: 600; }
    .demo-start p { margin: 14px 24px 0; font-size: 14px; color: var(--muted); }
  `;
  document.head.appendChild(style);

  /* ---------- помощники ---------- */
  async function waitFor(fn, timeout = 20000) {
    const t0 = Date.now();
    while (!stopped) {
      const v = fn();
      if (v) return v;
      if (Date.now() - t0 > timeout) throw new Error('demo: не дождались шага');
      await sleep(60);
    }
    throw new Error('demo: остановлено');
  }

  /* ---------- курсор ---------- */
  const cx = document.createElement('div');
  cx.className = 'demo-cx';
  cx.innerHTML = `<div class="demo-cy"><div class="demo-cur off">
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <path d="M4 3 L4 24 L9.6 18.8 L13.4 27.2 L17.4 25.4 L13.6 17.2 L21.2 17.2 Z"
          fill="#1C1C1E" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
      </svg></div></div>`;
  document.body.appendChild(cx);
  const cy = cx.firstElementChild, cur = cy.firstElementChild;
  const pos = { x: innerWidth * 0.62, y: innerHeight * 0.55 };

  function place(x, y, ms) {
    const t = ms + 'ms';
    cx.style.setProperty('--t', t);
    cy.style.setProperty('--t', t);
    cx.style.transform = `translateX(${x}px)`;
    cy.style.transform = `translateY(${y}px)`;
    pos.x = x; pos.y = y;
  }
  place(pos.x, pos.y, 0);

  /** Плавно подвести курсор к точке; время зависит от расстояния. */
  async function moveTo(x, y) {
    const d = Math.hypot(x - pos.x, y - pos.y);
    if (d < 2) return;
    const ms = Math.round(Math.min(950, 380 + d * 1.1));
    place(x, y, ms);
    await sleep(ms + 60);
  }

  function touchAt(x, y) {
    const dot = document.createElement('i');
    dot.className = 'demo-touch';
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  }

  /** «Нажать» на элемент: курсор подъезжает, щелчок с кольцом, затем настоящий клик. */
  async function tap(sel, after = 0) {
    const el = typeof sel === 'string' ? await waitFor(() => $(sel)) : sel;
    const r = el.getBoundingClientRect();
    // целимся чуть левее центра — как живой человек, а не робот
    const x = r.left + Math.min(r.width * 0.42, r.width / 2), y = r.top + r.height * 0.55;
    await moveTo(x, y);
    await sleep(90);
    cur.classList.add('down');
    el.classList.add('demo-press');
    touchAt(x, y);
    await sleep(140);
    cur.classList.remove('down');
    el.classList.remove('demo-press');
    // список мог перерисоваться под пальцем — нажимаем на актуальный элемент
    (typeof sel === 'string' && !el.isConnected ? $(sel) || el : el).click();
    if (after) await sleep(after);
  }

  async function type(input, text) {
    for (const ch of text) {
      input.value += ch;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(85 + Math.random() * 60);
    }
  }

  /* ---------- сценарий ---------- */
  /** Пока идёт анимация (маршрут, поездка) — курсор отъезжает в сторону, чтобы не закрывать кадр. */
  const park = () => moveTo(innerWidth * 0.8, innerHeight * 0.36);

  async function scenario() {
    await waitFor(() => S.view === 'home' && $('.search-btn'));
    GIR.ui.sheet.refresh();
    cur.classList.remove('off');
    await sleep(900);

    // 1. Поиск: «Куда поедем?» → набираем «Парк Г» → выбираем Парк Горького
    await tap('.search-btn', 450);
    const q = await waitFor(() => $('#q'));
    q.blur(); // без клавиатуры на телефоне
    const qr = q.getBoundingClientRect();
    moveTo(qr.left + qr.width * 0.75, qr.bottom + 34); // курсор отходит от поля, пока «печатаем»
    await type(q, 'Парк Г');
    // ждём, пока подгрузятся адреса, чтобы список не прыгнул в момент нажатия
    await waitFor(() => !$('#results .searching'), 6000).catch(() => {});
    await sleep(600);
    await tap('#results [data-arg="gorky"]');

    // 2. Маршрут прорисовывается по красным коридорам
    park();
    await waitFor(() => S.view === 'route' && S.route && $('#payBtn'));
    await sleep(1700);

    // 3. Тариф: ползунок на подписку и обратно, оплата 90 ₽
    if ($('#tariffSeg')) {
      await tap('#tariffSeg [data-arg="sub"]', 650);
      await tap('#tariffSeg [data-arg="single"]', 550);
    }
    await tap('#payBtn', 300);
    park();
    if (S.route.none) { await waitFor(() => S.view === 'ride'); return finishRide(); }

    // 4. Едем к шлюзу, на шлюзе — QR-билет и стеклянный турникет
    await waitFor(() => S.view === 'gate' && $('#gBtn'), 60000);
    await sleep(1500);
    await tap('#gBtn', 300);
    park();

    // 5. Поездка по коридору
    await waitFor(() => S.view === 'ride' && S.ride.gateIn);
    await sleep(2600);

    // 6. SOS: прокол → механик едет из ближайшего хаба → починили
    await tap('[data-act="sos"]', 700);
    await tap('[data-act="sosSend"][data-arg="tire"]', 200);
    park();
    await waitFor(() => $('[data-act="sosDone"]'), 15000);
    await sleep(900);
    await tap('[data-act="sosDone"]', 200);
    park();

    return finishRide();
  }

  async function finishRide() {
    // 7. Немного едем и «перематываем» до финиша
    await waitFor(() => S.view === 'ride');
    await sleep(1600);
    S.simSpeed = 10;
    await waitFor(() => S.view === 'finish', 120000);
    S.simSpeed = 2;
    await sleep(1100);
    await tap('#stars [data-arg="5"]', 1600);
    cur.classList.add('off');
    overlay('Ещё раз', 'Сценарий закончился. Нажмите, чтобы повторить.', () => location.reload());
  }

  /* ---------- экран «Начать»: включите запись экрана, потом нажмите ---------- */
  function overlay(label, hint, onTap) {
    const o = document.createElement('div');
    o.className = 'demo-start';
    o.innerHTML = `<div><b>▶ ${label}</b><p>${hint}</p></div>`;
    o.addEventListener('click', (e) => {
      e.stopPropagation();
      o.classList.add('hide');
      setTimeout(() => o.remove(), 600);
      onTap();
    }, { once: true });
    document.body.appendChild(o);
  }

  overlay('Начать демо', 'Включите запись экрана, затем нажмите — сценарий пройдёт сам.', async () => {
    await sleep(1200); // чистое начало для монтажа
    try { await scenario(); } catch (e) { console.warn(e); }
  });
})();
