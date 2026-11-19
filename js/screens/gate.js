/* Шлюз: приложить телефон (NFC) или показать QR-билет → проверка → сигнал зелёный → болларды уходят в землю.
   QR-код — для разового въезда: билет с номером и сроком действия, код обновляется каждые 30 секунд. */
(function () {
  const S = GIR.state, C = GIR.config, F = GIR.fmt, I = GIR.I, $ = GIR.$, N = GIR.net.nodes;
  const QR_PERIOD = 30; // с
  let timers = [], qrTimer = 0, mode = 'nfc', ticket = null;

  function clearAll() {
    timers.forEach(clearTimeout);
    timers = [];
    clearInterval(qrTimer);
    qrTimer = 0;
  }

  function show() {
    const r = S.route, g = N[r.corridor.gates[0]];
    S.view = 'gate';
    clearAll();
    // QR-билет есть всегда: и для разового въезда, и для подписки (телефон/NFC — на выбор)
    const single = !!S.ride;
    const bySub = GIR.subActive();
    mode = 'qr';
    if (!S.ride.ticket) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      S.ride.ticket = bySub
        ? { id: 'SUB-' + code, until: new Date(S.sub.until), label: 'Подписка · до ' + F.date(new Date(S.sub.until)) }
        : { id: 'GR-' + code, until: new Date(Date.now() + C.SINGLE_HOURS * 3600e3) };
      if (!bySub) S.ride.ticket.label = 'Разовый въезд · до ' + F.clock(S.ride.ticket.until);
    }
    ticket = S.ride.ticket || null;
    GIR.mapView.follow(g.ll, 17);

    GIR.ui.sheet.set(`
      <div class="gate">
        <h2 class="title" id="gTitle">Шлюз «${g.n}»</h2>
        <p class="lead" id="gSub">${mode === 'qr' ? 'Покажите QR-код сканеру шлюза' : 'Приложите телефон к считывателю'}</p>

        ${single ? `
          <div class="seg seg-slide gate-mode ${mode === 'qr' ? 'right' : ''}" id="gateMode">
            <i class="seg-thumb"></i>
            <button class="${mode === 'nfc' ? 'on' : ''}" data-act="gateMode" data-arg="nfc"><b>Телефон</b></button>
            <button class="${mode === 'qr' ? 'on' : ''}" data-act="gateMode" data-arg="qr"><b>QR-код</b></button>
          </div>` : ''}

        <div class="gs ${mode === 'qr' ? 'qr-mode' : ''}" id="gScene">
          <div class="gs-reader">
            <svg class="gs-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle class="gs-ring-bg" cx="60" cy="60" r="54"/>
              <circle class="gs-ring-fg" cx="60" cy="60" r="54"/>
            </svg>
            <span class="gs-wave"></span><span class="gs-wave"></span>
            <span class="gs-core">
              <span class="gs-nfc">${I.nfc}</span>
              <svg class="gs-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            </span>
            <span class="gs-burst"></span>
          </div>

          ${single ? `
          <div class="qr-card" id="qrCard">
            <div class="qr-box gen" id="qrBox">
              <div id="qrCode" aria-label="QR-код билета"></div>
              <i class="qr-scan"></i>
              <span class="qr-ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
            </div>
            <div class="qr-meta">
              <b>${ticket.id}</b>
              <span>${ticket.label}</span>
            </div>
            <div class="qr-timer"><i id="qrBar"></i></div>
            <span class="qr-hint">Код обновится через <b id="qrSec">${QR_PERIOD}</b> с</span>
          </div>` : ''}

          <div class="gs-gate">
            ${cab('l')}
            <div class="ts-lane"><i class="ts-flap l"></i><i class="ts-flap r"></i></div>
            ${cab('r')}
          </div>
          <div class="gs-road"></div>
        </div>

        <button class="btn primary" id="gBtn" data-act="tapGate">${btnLabel()}</button>
      </div>`, { tall: single }); // с QR-кодом шторка выше, чтобы кнопка помещалась

    if (single) startQr();
  }

  // тумба стеклянного турникета: табло (красный «стоп» → зелёная стрелка) и светодиодная полоса
  const cab = (side) => `<div class="ts-cab ${side}"><span class="ts-lamp">
      <svg class="ts-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>
      <svg class="ts-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>
    </span></div>`;

  const btnLabel = () => (mode === 'qr' ? `${I.check}Сканер считал код` : `${I.nfc}Приложить телефон`);

  /* ---------- QR: генерация и обновление каждые 30 с ---------- */
  function drawQr() {
    const box = $('#qrBox'), el = $('#qrCode');
    if (!box || !el || !ticket) return;
    const nonce = Math.floor(Date.now() / 1000).toString(36);
    const payload = `GIR1|${ticket.id}|${S.route.corridor.gates[0]}|${ticket.until.toISOString()}|${nonce}`;
    box.classList.remove('gen'); void box.offsetWidth; box.classList.add('gen'); // «проявление» нового кода
    el.innerHTML = '';
    if (window.QRCode) {
      new QRCode(el, { text: payload, width: 172, height: 172, colorDark: '#1C1C1E', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
    } else {
      el.innerHTML = `<div class="qr-fallback">${ticket.id}</div>`; // библиотека не загрузилась — показываем номер билета
    }
    // полоса-таймер: заново на 30 секунд
    const bar = $('#qrBar');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${QR_PERIOD}s linear`; bar.style.width = '0%'; }
  }

  function startQr() {
    clearInterval(qrTimer);
    drawQr();
    let left = QR_PERIOD;
    qrTimer = setInterval(() => {
      if (S.view !== 'gate' || mode !== 'qr') { clearInterval(qrTimer); qrTimer = 0; return; }
      left -= 1;
      if (left <= 0) { left = QR_PERIOD; drawQr(); }
      const s = $('#qrSec');
      if (s) s.textContent = left;
    }, 1000);
  }

  function setMode(m) {
    if (m === mode || $('#gBtn').disabled) return;
    mode = m;
    $('#gateMode').classList.toggle('right', m === 'qr');
    document.querySelectorAll('#gateMode button').forEach((b) => b.classList.toggle('on', b.dataset.arg === m));
    $('#gScene').classList.toggle('qr-mode', m === 'qr');
    $('#gSub').textContent = m === 'qr' ? 'Покажите QR-код сканеру шлюза' : 'Приложите телефон к считывателю';
    $('#gBtn').innerHTML = btnLabel();
    if (m === 'qr') startQr(); else { clearInterval(qrTimer); qrTimer = 0; }
  }

  /* ---------- проверка и открытие ---------- */
  function tap() {
    const btn = $('#gBtn'), scene = $('#gScene');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const gm = $('#gateMode');
    if (gm) gm.classList.add('locked');
    clearInterval(qrTimer);
    qrTimer = 0;
    btn.innerHTML = mode === 'qr' ? 'Сканируем…' : 'Проверяем…';
    scene.classList.add('scan');
    $('#gSub').textContent = mode === 'qr' ? 'Держите экран у сканера' : 'Держите телефон у считывателя';

    const k = (C.GATE_MS || 3300) / 3300; // демо может ускорить проезд шлюза
    const at = (ms, fn) => timers.push(setTimeout(fn, ms * k));
    at(1100, () => {
      scene.classList.remove('scan');
      scene.classList.add('ok');
      $('#gTitle').textContent = 'Доступ подтверждён';
      $('#gSub').textContent = GIR.subActive() ? 'По подписке' : `Разовый въезд, действует ${C.SINGLE_HOURS} часа`;
      try { if (GIR.settings.vibro && navigator.vibrate) navigator.vibrate([40, 60, 40]); } catch (e) { /* нет поддержки */ }
    });
    at(1500, () => scene.classList.add('open'));          // сигнал зелёный, болларды уходят вниз
    at(2500, () => {
      $('#gTitle').textContent = 'Шлюз открыт — проезжайте';
      $('#gSub').textContent = 'Дальше нет машин, бордюров и светофоров';
      btn.innerHTML = 'Проезжаем…';
    });
    at(3300, () => { if (S.view === 'gate') GIR.screens.ride.gatePassed(); });
  }

  GIR.screens.gate = { show };
  GIR.actions.tapGate = tap;
  GIR.actions.gateMode = setMode;
})();
