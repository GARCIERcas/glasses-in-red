/* Карта: Яндекс Карты JS API 2.1. Весь остальной код работает с картой только через GIR.mapView. */
(function () {
  const C = GIR.config, net = GIR.net, I = GIR.I;
  const RED = '#E4002B', ROAD = '#1D5BEA', DONE = '#9097A1';
  const TRANSPARENT = 'default#transparent'; // линии не перехватывают клики по карте

  let map, netColl, routeColl, liveColl;
  let netLines = [], netMarks = [], dimmed = false;
  let doneLine = null, rider = null, mech = null, mechLine = null;
  let clickHandler = null;
  let L = {}; // макеты меток (создаются после загрузки API)

  function loadApi() {
    return new Promise((resolve, reject) => {
      if (window.ymaps) return ymaps.ready(resolve);
      const s = document.createElement('script');
      s.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU' + (C.YANDEX_API_KEY ? '&apikey=' + encodeURIComponent(C.YANDEX_API_KEY) : '');
      s.onload = () => ymaps.ready(resolve);
      s.onerror = () => reject(new Error('Яндекс Карты не загрузились'));
      document.head.appendChild(s);
    });
  }

  async function init() {
    await loadApi();
    const html = (s) => ymaps.templateLayoutFactory.createClass(s);
    L = {
      gate: html('<div class="mk-anchor"><div class="mk-gate"></div></div>'),
      hub: html(`<div class="mk-anchor"><div class="mk-hub">${I.wrench}</div></div>`),
      gateBig: html(`<div class="mk-anchor"><div class="map-label">{{ properties.label }}</div><div class="mk-gate big {{ properties.cls }}">${I.gate}</div></div>`),
      pinA: html('<div class="mk-anchor"><div class="mk-pin a"></div></div>'),
      pinB: html('<div class="mk-anchor"><div class="mk-pin b"></div></div>'),
      rider: html(`<div class="mk-anchor"><div class="mk-rider"><div class="mk-rider-arrow" id="riderArrow">${I.navArrow}</div></div></div>`),
      mech: html(`<div class="mk-anchor"><div class="mk-mech">${I.wrench}</div></div>`),
      me: html('<div class="mk-anchor"><div class="mk-me"></div></div>')
    };

    map = new ymaps.Map('map', { center: C.MAP_CENTER, zoom: C.MAP_ZOOM, controls: [] }, {
      suppressMapOpenBlock: true,
      yandexMapDisablePoiInteractivity: true,
      minZoom: 9,
      maxZoom: 19
    });
    netColl = new ymaps.GeoObjectCollection();
    routeColl = new ymaps.GeoObjectCollection();
    liveColl = new ymaps.GeoObjectCollection();
    map.geoObjects.add(netColl).add(routeColl).add(liveColl);

    map.events.add('click', (e) => clickHandler && clickHandler(e.get('coords')));
    // пользователь сам двигает карту — перестаём следовать за велосипедистом
    map.events.add(['mousedown', 'multitouchstart', 'wheel'], () => {
      if (GIR.state.view === 'ride') GIR.state.follow = false;
    });
    drawNetwork();
  }

  const mark = (ll, layout, props, opts) => new ymaps.Placemark(ll, props || {}, Object.assign({
    iconLayout: layout,
    iconShape: { type: 'Circle', coordinates: [0, 0], radius: 12 }
  }, opts || {}));

  const line = (coords, opts) => new ymaps.Polyline(coords, {}, Object.assign({ interactivityModel: TRANSPARENT }, opts));

  /* ---------- сеть коридоров ---------- */
  function drawNetwork() {
    netColl.removeAll();
    netLines = [];
    // один коридор = одна линия (вместо отдельной на каждый участок) — объектов на карте в разы меньше
    for (const l of Object.values(net.lines)) {
      const coords = [];
      for (let i = 0; i < l.chain.length - 1; i++) {
        const c = net.coordsOf(l.chain[i], l.chain[i + 1]);
        coords.push(...(coords.length ? c.slice(1) : c));
      }
      const glow = line(coords, { strokeColor: RED, strokeWidth: 10, strokeOpacity: 0.12, zIndex: 10 });
      const ln = line(coords, { strokeColor: RED, strokeWidth: 4, strokeOpacity: 0.85, zIndex: 11 });
      netColl.add(glow).add(ln);
      netLines.push(glow, ln);
    }
    netMarks = [];
    for (const k in net.nodes) {
      const n = net.nodes[k];
      const m = mark(n.ll, n.hub ? L.hub : L.gate,
        { hintContent: (n.hub ? 'Шлюз + SOS-хаб · ' : 'Шлюз · ') + n.n },
        { zIndex: n.hub ? 210 : 200 });
      netColl.add(m);
      netMarks.push(m);
    }
    dim(dimmed);
  }

  /* при построенном маршруте сеть приглушаем, а метки чужих шлюзов прячем */
  function dim(on) {
    dimmed = on;
    netLines.forEach((p, i) => p.options.set('strokeOpacity', on ? (i % 2 ? 0.25 : 0.04) : (i % 2 ? 0.85 : 0.12)));
    netMarks.forEach((m) => m.options.set('visible', !on));
  }

  /* ---------- маршрут ---------- */
  /* маршрут «прорисовывается» от старта к финишу, участок за участком */
  let drawTimer = 0;
  function animateLegs(items, total) {
    clearTimeout(drawTimer);
    const cum = [];
    let acc = 0;
    items.forEach((it) => { cum.push(acc); acc += it.km; });
    const t0 = performance.now();
    (function step() {
      const f = Math.min(1, (performance.now() - t0) / total);
      const e = 1 - Math.pow(1 - f, 3);
      const km = e * acc;
      items.forEach((it, i) => {
        const local = km - cum[i];
        const cs = it.cumKm;
        let coords;
        if (local <= 0) coords = [];
        else if (local >= it.km) coords = it.coords;
        else coords = GIR.geo.sliceTo(it.coords, cs, local);
        it.objs.forEach((o) => o.geometry.setCoordinates(coords));
      });
      if (f < 1) drawTimer = setTimeout(step, 16);
    })();
  }

  function drawRoute(r) {
    routeColl.removeAll();
    dim(true);
    const anim = [];
    r.legs.forEach((leg) => {
      const objs = [];
      if (leg.type === 'corridor') {
        objs.push(line([], { strokeColor: RED, strokeWidth: 20, strokeOpacity: 0.16, zIndex: 20 }));
        objs.push(line([], { strokeColor: ['#FFFFFF', RED], strokeWidth: [12, 8], zIndex: 21 }));
      } else {
        objs.push(line([], {
          strokeColor: ['#FFFFFF', ROAD], strokeWidth: [10, 6], zIndex: 21,
          strokeStyle: leg.ok ? 'solid' : 'shortdash' // пунктир — путь примерный, сервер не ответил
        }));
      }
      objs.forEach((o) => routeColl.add(o));
      anim.push({ objs, coords: leg.coords, cumKm: GIR.geo.cumulative(leg.coords), km: leg.km });
    });
    animateLegs(anim, 900);
    doneLine = line([], { strokeColor: DONE, strokeWidth: 8, strokeOpacity: 0.95, zIndex: 22 });
    routeColl.add(doneLine);

    const c = r.corridor;
    if (c) {
      c.gates.forEach((g, i) => {
        const n = net.nodes[g];
        const first = i === 0, last = i === c.gates.length - 1;
        if (first || last) {
          routeColl.add(mark(n.ll, L.gateBig,
            { label: (first ? 'Въезд · ' : 'Выезд · ') + n.n, cls: first ? 'in' : 'out' },
            { zIndex: 500 }));
        } else if (n.hub) {
          routeColl.add(mark(n.ll, L.hub, { hintContent: 'SOS-хаб · ' + n.n }, { zIndex: 400 }));
        }
      });
    }
    routeColl.add(mark(r.coords[0], L.pinA, {}, { zIndex: 600 }));
    routeColl.add(mark(r.coords[r.coords.length - 1], L.pinB, {}, { zIndex: 600 }));
  }

  function clearRoute() {
    if (!routeColl) return;
    hideRiderFixed();
    routeColl.removeAll();
    liveColl.removeAll();
    rider = mech = mechLine = doneLine = null;
    dim(false);
  }

  const setDone = (coords) => doneLine && doneLine.geometry.setCoordinates(coords);

  /* ---------- велосипедист ---------- */
  /* Велосипедист. Пока карта следует за ним, он нарисован неподвижной HTML-меткой в точке
     слежения (#riderFixed), а карта едет под ним — так нет дрожания «метка vs карта».
     Когда пользователь сам двигает карту — показываем обычную метку на карте. */
  let riderOnMap = true;
  function riderAt(ll, heading, fixed) {
    if (!rider) {
      rider = mark(ll, L.rider, {}, { zIndex: 1000, iconShape: { type: 'Circle', coordinates: [0, 0], radius: 22 } });
      liveColl.add(rider);
    }
    rider.geometry.setCoordinates(ll);
    const fx = document.getElementById('riderFixed');
    if (fixed !== !riderOnMap) {
      riderOnMap = !fixed;
      rider.options.set('visible', riderOnMap);
      fx.hidden = riderOnMap;
    }
    const rot = `rotate(${heading.toFixed(1)}deg)`;
    if (fixed) {
      const [x, y] = followPoint();
      fx.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      fx.querySelector('.mk-rider-arrow').style.transform = rot;
    } else {
      const a = document.getElementById('riderArrow');
      if (a) a.style.transform = rot;
    }
  }
  function hideRiderFixed() { const fx = document.getElementById('riderFixed'); if (fx) fx.hidden = true; riderOnMap = true; }
  const riderLL = () => (rider ? rider.geometry.getCoordinates() : null);

  /* ---------- механик (SOS) ---------- */
  function mechShow(from, to) {
    mechClear();
    mech = mark(from, L.mech, {}, { zIndex: 900 });
    mechLine = line([from, to], { strokeColor: '#15171A', strokeWidth: 3, strokeStyle: 'dash', zIndex: 30 });
    liveColl.add(mechLine).add(mech);
  }
  function mechMove(ll, to) {
    if (mech) mech.geometry.setCoordinates(ll);
    if (mechLine) mechLine.geometry.setCoordinates([ll, to]);
  }
  function mechArrived() { if (mechLine) { liveColl.remove(mechLine); mechLine = null; } }
  function mechClear() {
    if (mech) liveColl.remove(mech);
    if (mechLine) liveColl.remove(mechLine);
    mech = mechLine = null;
  }

  /* ---------- камера ---------- */
  function fit(latlngs) {
    let s = 90, w = 180, n = -90, e = -180;
    latlngs.forEach(([la, lo]) => { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); });
    const margin = GIR.ui.isDesk()
      ? [90, 70, 60, 450]
      : [80, 30, Math.min(GIR.ui.sheet.height(), innerHeight * 0.62) + 20, 30];
    map.container.fitToViewport();
    // зум и центр считаем сами и делаем один плавный перелёт: раньше setBounds приближал карту,
    // а затем резко откатывал зум до 16 — картинка дёргалась (особенно при вызове механика)
    const [mt, mr, mb, ml] = margin, size = map.container.getSize();
    const aw = Math.max(40, size[0] - ml - mr), ah = Math.max(40, size[1] - mt - mb);
    const proj = map.options.get('projection');
    let z = 16;
    for (; z > 9; z--) {
      const a = proj.toGlobalPixels([n, w], z), b = proj.toGlobalPixels([s, e], z);
      if (b[0] - a[0] <= aw && b[1] - a[1] <= ah) break;
    }
    const a = proj.toGlobalPixels([n, w], z), b = proj.toGlobalPixels([s, e], z);
    // середина рамки встаёт в центр свободной от шторки и кнопок области
    const cx = (a[0] + b[0]) / 2 - (ml - mr) / 2, cy = (a[1] + b[1]) / 2 - (mt - mb) / 2;
    lastFollow = '';
    map.setCenter(proj.fromGlobalPixels([cx, cy], z), z, { duration: 400 });
  }

  function fly(ll, z) { map.setCenter(ll, z, { duration: 500 }); }

  /* В поездке держим велосипедиста над шторкой (телефон) или чуть ниже центра (компьютер) */
  const followOffset = () => (GIR.ui.isDesk() ? -70 : Math.min(GIR.ui.sheet.height(), innerHeight * 0.5) / 2 - 40);
  /** Экранная точка, где стоит велосипедист, когда карта следует за ним. */
  function followPoint() {
    const c = containerCenterPage();
    return [Math.round(c[0]), Math.round(c[1] - followOffset())];
  }
  let lastFollow = '';
  function follow(ll, z, instant) {
    if (!ll) return;
    z = z || map.getZoom();
    const proj = map.options.get('projection');
    const gp = proj.toGlobalPixels(ll, z);
    const cg = [gp[0], gp[1] + followOffset()];
    if (instant) {
      // карта сдвигается целыми пикселями — так она и метка в точке слежения не расходятся
      const key = Math.round(cg[0]) + ',' + Math.round(cg[1]) + ',' + z;
      if (key === lastFollow) return;
      lastFollow = key;
      map.setCenter(proj.fromGlobalPixels([Math.round(cg[0]), Math.round(cg[1])], z), z);
    } else {
      lastFollow = '';
      map.setCenter(proj.fromGlobalPixels(cg, z), z, { duration: 350 });
    }
  }

  /* ---------- места категории (кафе, парки…) ---------- */
  let poiColl = null;
  const poiLayouts = {};
  function showPois(list, cat, onPick) {
    if (!poiColl) { poiColl = new ymaps.GeoObjectCollection(); map.geoObjects.add(poiColl); }
    poiColl.removeAll();
    if (!poiLayouts[cat.id]) {
      poiLayouts[cat.id] = ymaps.templateLayoutFactory.createClass(
        `<div class="mk-anchor"><div class="mk-poi" style="background:${cat.color}">${I[cat.ic]}</div></div>`);
    }
    list.forEach((p) => {
      const m = mark(p.ll, poiLayouts[cat.id], { hintContent: p.n }, { zIndex: 700, iconShape: { type: 'Circle', coordinates: [0, 0], radius: 16 } });
      m.events.add('click', (e) => { e.stopPropagation(); onPick(p.id); });
      poiColl.add(m);
    });
  }
  function clearPois() { if (poiColl) poiColl.removeAll(); }

  /* ---------- «я здесь» ---------- */
  let me = null, meColl = null;
  function setMe(ll) {
    if (!meColl) { meColl = new ymaps.GeoObjectCollection(); map.geoObjects.add(meColl); }
    if (!me) {
      me = mark(ll, L.me, { hintContent: 'Вы здесь' }, { zIndex: 950 });
      meColl.add(me);
    } else me.geometry.setCoordinates(ll);
  }
  function showMe(on) { if (meColl) meColl.options.set('visible', !!on); }

  /* ---------- пикер: точка под булавкой ---------- */
  function containerCenterPage() {
    const r = document.getElementById('map').getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }
  /** Координаты точки карты под экранной позицией (x, y). */
  function latLngAt(x, y) {
    const z = map.getZoom(), proj = map.options.get('projection');
    const gc = proj.toGlobalPixels(map.getCenter(), z);
    const c = containerCenterPage();
    return proj.fromGlobalPixels([gc[0] + (x - c[0]), gc[1] + (y - c[1])], z);
  }
  /** Сдвигает карту так, чтобы точка ll оказалась под экранной позицией (x, y). */
  function placeUnder(ll, x, y, z) {
    z = z || map.getZoom();
    const proj = map.options.get('projection');
    const g = proj.toGlobalPixels(ll, z);
    const c = containerCenterPage();
    map.setCenter(proj.fromGlobalPixels([g[0] + (c[0] - x), g[1] + (c[1] - y)], z), z, { duration: 300 });
  }
  let moveHandlers = null;
  function onMove(start, end) {
    if (moveHandlers) { map.events.remove('actionbegin', moveHandlers[0]); map.events.remove('actionend', moveHandlers[1]); }
    moveHandlers = start ? [start, end] : null;
    if (start) { map.events.add('actionbegin', start); map.events.add('actionend', end); }
  }

  GIR.mapView = {
    init, drawNetwork, drawRoute, clearRoute, setDone, riderAt, riderLL, fit, fly, follow,
    mechShow, mechMove, mechArrived, mechClear,
    latLngAt, placeUnder, onMove, setMe, showMe, showPois, clearPois,
    /** Приблизить (+1) / отдалить (−1). В поездке без анимации — иначе её перебьёт слежение за велосипедистом. */
    zoomBy(d) {
      const z = Math.max(9, Math.min(19, Math.round(map.getZoom()) + d));
      if (z === map.getZoom()) return;
      lastFollow = '';
      if (GIR.state.view === 'ride' && GIR.state.follow) map.setZoom(z);
      else map.setZoom(z, { duration: 250 });
    },
    onClick: (fn) => { clickHandler = fn; },
    resize: () => map && map.container.fitToViewport(),
    setView: (ll, z) => map.setCenter(ll, z, { duration: 300 }),
    getZoom: () => map.getZoom(),
    /** экранные координаты точки — для автотестов */
    toScreen: (ll) => {
      const p = map.converter.globalToPage(map.options.get('projection').toGlobalPixels(ll, map.getZoom()));
      return { x: Math.round(p[0]), y: Math.round(p[1]) };
    }
  };
})();
