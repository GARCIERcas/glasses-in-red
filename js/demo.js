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
    .demo-touch {
      position: fixed; z-index: 9999; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      background: rgba(28, 28, 30, .22); border: 2px solid rgba(255, 255, 255, .9);
      box-shadow: 0 2px 10px rgba(0, 0, 0, .18); pointer-events: none;
      animation: demoTouch .55s cubic-bezier(.2, .8, .2, 1) forwards;
    }
    @keyframes demoTouch { 0% { transform: scale(.4); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.35); opacity: 0; } }
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

  function touchAt(el) {
    const r = el.getBoundingClientRect();
    const dot = document.createElement('i');
    dot.className = 'demo-touch';
    dot.style.left = r.left + r.width / 2 + 'px';
    dot.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  }

  /** «Нажать» на элемент: кружок касания, лёгкое нажатие, затем настоящий клик. */
  async function tap(sel, after = 0) {
    const el = typeof sel === 'string' ? await waitFor(() => $(sel)) : sel;
    touchAt(el);
    el.classList.add('demo-press');
    await sleep(140);
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
  async function scenario() {
    await waitFor(() => S.view === 'home' && $('.search-btn'));
    GIR.ui.sheet.refresh();
    await sleep(900);

    // 1. Поиск: «Куда поедем?» → набираем «Парк Г» → выбираем Парк Горького
    await tap('.search-btn', 450);
    const q = await waitFor(() => $('#q'));
    q.blur(); // без клавиатуры на телефоне
    await type(q, 'Парк Г');
    // ждём, пока подгрузятся адреса, чтобы список не прыгнул в момент нажатия
    await waitFor(() => !$('#results .searching'), 6000).catch(() => {});
    await sleep(600);
    await tap('#results [data-arg="gorky"]');

    // 2. Маршрут прорисовывается по красным коридорам
    await waitFor(() => S.view === 'route' && S.route && $('#payBtn'));
    await sleep(1700);

    // 3. Тариф: ползунок на подписку и обратно, оплата 90 ₽
    if ($('#tariffSeg')) {
      await tap('#tariffSeg [data-arg="sub"]', 650);
      await tap('#tariffSeg [data-arg="single"]', 550);
    }
    await tap('#payBtn');
    if (S.route.none) { await waitFor(() => S.view === 'ride'); return finishRide(); }

    // 4. Едем к шлюзу, на шлюзе — QR-билет и стеклянный турникет
    await waitFor(() => S.view === 'gate' && $('#gBtn'), 60000);
    await sleep(1500);
    await tap('#gBtn');

    // 5. Поездка по коридору
    await waitFor(() => S.view === 'ride' && S.ride.gateIn);
    await sleep(2600);

    // 6. SOS: прокол → механик едет из ближайшего хаба → починили
    await tap('[data-act="sos"]', 700);
    await tap('[data-act="sosSend"][data-arg="tire"]');
    await waitFor(() => $('[data-act="sosDone"]'), 15000);
    await sleep(900);
    await tap('[data-act="sosDone"]');

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
