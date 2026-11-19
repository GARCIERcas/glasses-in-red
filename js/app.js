/* Точка входа: карта, сеть коридоров, обработчики, первый экран. */
(async function () {
  const S = GIR.state, $ = GIR.$;

  // Все кнопки работают через data-act="имя" data-arg="аргумент"
  const run = (el, e) => {
    const fn = GIR.actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset.arg, el, e); }
  };
  let fastAt = 0, ghostPending = false;
  document.addEventListener('click', (e) => {
    if (performance.now() - GIR.ui.sheet.justDragged < 300) return; // это был свайп шторки, а не нажатие
    // «хвост» быстрого нажатия: гасим ровно один клик от того же касания, следующие нажатия работают сразу
    if (ghostPending && performance.now() - fastAt < 600) { ghostPending = false; e.preventDefault(); e.stopPropagation(); return; }
    ghostPending = false;
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    // data-fast уже сработал на касании; если касание почему-то не дошло — выполняем по обычному клику
    if (el.hasAttribute('data-fast') && performance.now() - fastAt < 1500) return;
    run(el, e);
  });
  // data-fast — срабатывает в момент касания: пока открыта клавиатура, обычный click
  // промахивается (клавиатура закрывается, шторка прыгает вниз раньше, чем палец отпущен)
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-act][data-fast]');
    if (el && !el.disabled) { fastAt = performance.now(); ghostPending = true; run(el, e); }
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') GIR.ui.closeAll(); });

  Object.assign(GIR.actions, {
    closeAll: GIR.ui.closeAll,
    legend() { $('#legend').hidden = !$('#legend').hidden; },
    zoomIn() { GIR.mapView.zoomBy(1); },
    zoomOut() { GIR.mapView.zoomBy(-1); },
    async locate() {
      const ll = GIR.mapView.riderLL();
      if (ll) { S.follow = true; GIR.mapView.follow(ll, GIR.config.RIDE_ZOOM); return; }
      if (!GIR.location.asked) {
        const real = await GIR.location.request();
        GIR.ui.toast(real ? 'Геопозиция определена' : 'Демо-геопозиция: Таганская площадь');
        GIR.mapView.setMe(GIR.location.ll);
        if (S.from && S.from.id === 'me') S.from = GIR.location.place();
        if (S.view === 'home') GIR.screens.home.show();
      }
      GIR.mapView.follow(GIR.location.ll, 15);
    }
  });

  // Сеть коридоров: геометрия вшита в js/data/corridors.js, поэтому готова сразу
  GIR.netReady = GIR.net.load().catch(() => false);
  await GIR.netReady;

  try {
    await GIR.mapView.init();
  } catch (e) {
    $('#sheetBody').innerHTML = '<h2 class="title">Карта не загрузилась</h2><p class="lead">Проверьте интернет и обновите страницу.</p>';
    return;
  }
  GIR.mapView.onClick((ll) => GIR.screens.search.mapClick(ll));
  GIR.mapView.setMe(GIR.location.ll);
  $('#netStatus').textContent = '−3° · коридоры очищены';

  addEventListener('resize', () => { GIR.mapView.resize(); GIR.ui.sheet.refresh(); });
  new ResizeObserver(() => GIR.ui.sheet.refresh()).observe($('#sheet'));

  GIR.screens.home.show();
})();
