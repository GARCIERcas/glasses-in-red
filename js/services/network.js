/* Граф коридоров: рёбра, привязка к улицам, поиск оптимального пути через шлюзы. */
(function () {
  const { nodes, lines } = GIR.data;
  const C = GIR.config, geo = GIR.geo;

  const edges = [];
  const adj = {};
  Object.keys(nodes).forEach((k) => (adj[k] = []));

  for (const [id, l] of Object.entries(lines)) {
    for (let i = 0; i < l.chain.length - 1; i++) {
      const a = l.chain[i], b = l.chain[i + 1];
      const e = { a, b, line: id, coords: [nodes[a].ll, nodes[b].ll] };
      e.km = geo.hav(e.coords[0], e.coords[1]);
      edges.push(e);
      adj[a].push(e);
      adj[b].push(e);
    }
  }

  const edge = (a, b) => adj[a].find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const coordsOf = (a, b) => {
    const e = edge(a, b);
    return e.a === a ? e.coords : e.coords.slice().reverse();
  };
  const lineOf = (a, b) => {
    const e = edge(a, b);
    return e ? e.line : null;
  };
  const hubs = Object.keys(nodes).filter((k) => nodes[k].hub);
  const totalKm = () => edges.reduce((s, e) => s + e.km, 0);
  const lineKm = (id) => edges.filter((e) => e.line === id).reduce((s, e) => s + e.km, 0);

  /* ---------- привязка коридоров к реальным улицам ---------- */
  /* ---------- выпрямление: коридор идёт вдоль улицы, но без петель, разворотов и объездов площадей
     (на сложных развязках в реальности — мосты и эстакады) ---------- */
  function straighten(coords, A, B) {
    const k = Math.cos((A[0] * Math.PI) / 180);
    const xy = (p) => [(p[1] - A[1]) * 111.32 * k, (p[0] - A[0]) * 110.57]; // км в локальной плоскости
    const b = xy(B);
    const L2 = b[0] * b[0] + b[1] * b[1];
    const len = Math.sqrt(L2);
    if (len < 0.01) return [A, B];
    const maxDev = Math.max(0.06, len * 0.18); // дальше этого от прямой — объезд, срезаем

    // 1) только поступательное движение от A к B, без больших отклонений в сторону
    const kept = [A];
    let lastT = 0;
    for (const p of coords) {
      const q = xy(p);
      const t = (q[0] * b[0] + q[1] * b[1]) / L2;
      const dev = Math.abs(q[0] * b[1] - q[1] * b[0]) / len;
      if (t > lastT + 0.01 && t < 0.99 && dev < maxDev) { kept.push(p); lastT = t; }
    }
    kept.push(B);

    // 2) Дуглас — Пекер: убираем мелкие зигзаги (допуск 25 м)
    const tol = 0.025;
    const keep = new Array(kept.length).fill(false);
    keep[0] = keep[kept.length - 1] = true;
    (function dp(i, j) {
      if (j <= i + 1) return;
      const a = xy(kept[i]), c = xy(kept[j]);
      const dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1e-9;
      let best = -1, bi = -1;
      for (let m = i + 1; m < j; m++) {
        const q = xy(kept[m]);
        const dist = Math.abs((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / d;
        if (dist > best) { best = dist; bi = m; }
      }
      if (best > tol) { keep[bi] = true; dp(i, bi); dp(bi, j); }
    })(0, kept.length - 1);
    const simple = kept.filter((_, i) => keep[i]);

    // 3) лёгкое скругление углов (Чайкин, один проход), концы на месте
    if (simple.length < 3) return simple;
    const out = [simple[0]];
    for (let i = 0; i < simple.length - 1; i++) {
      const p = simple[i], q = simple[i + 1];
      if (i > 0) out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
      if (i < simple.length - 2) out.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    out.push(simple[simple.length - 1]);
    return out;
  }

  /* data = { nodes: {id: [lat,lng]}, edges: {'a|b': coords} }
     Шлюзы переносятся на точки привязки к улице, чтобы линии не делали «шипов» к схеме. */
  function apply(data) {
    for (const k in data.nodes) nodes[k].ll = data.nodes[k];
    edges.forEach((e) => {
      const c = data.edges[e.a + '|' + e.b];
      const A = nodes[e.a].ll, B = nodes[e.b].ll;
      if (!c || c.length < 2) {
        e.coords = [A, B];
        e.km = geo.hav(A, B);
        return;
      }
      e.raw = c; // исходная геометрия по улицам — её и сохраняем при пересборке
      const coords = straighten(c, A, B);
      const km = geo.lengthKm(coords);
      e.coords = coords;
      e.km = km;
    });
  }

  let snapped = false;
  async function load() {
    // 1) геометрия, вшитая в проект (js/data/corridors.js) — без сети, мгновенно
    //    (рёбер, которых там нет, рисуем прямыми — сеть не ждёт сервер)
    if (GIR.data.corridors && GIR.data.corridors.edges) {
      apply(GIR.data.corridors);
      snapped = true;
      return true;
    }
    // 2) кэш браузера, 3) запрос к серверу маршрутов
    const cached = GIR.store.get(C.NET_CACHE_KEY, null);
    if (cached && cached.edges) {
      apply(cached);
      snapped = true;
      return true;
    }
    const round = (p) => [+p[0].toFixed(5), +p[1].toFixed(5)];
    const out = { nodes: {}, edges: {} };
    const snaps = {}; // все привязки шлюза из разных коридоров → усредним
    // длинные коридоры сервер целиком не принимает — режем на куски по 4 шлюза
    for (const l of Object.values(lines)) {
      for (let s = 0; s < l.chain.length - 1; s += 3) {
        const part = l.chain.slice(s, s + 4);
        const res = await GIR.roads.chain(part.map((k) => nodes[k].ll));
        if (!res) continue;
        res.legs.forEach((c, i) => { out.edges[part[i] + '|' + part[i + 1]] = c.map(round); });
        res.snapped.forEach((p, i) => { (snaps[part[i]] = snaps[part[i]] || []).push(p); });
      }
    }
    if (!Object.keys(out.edges).length) return false;
    for (const k in snaps) {
      const s = snaps[k];
      out.nodes[k] = round([s.reduce((a, p) => a + p[0], 0) / s.length, s.reduce((a, p) => a + p[1], 0) / s.length]);
    }
    GIR.store.set(C.NET_CACHE_KEY, out);
    apply(out);
    snapped = true;
    return true;
  }

  /* ---------- поиск пути: старт → шлюз входа → коридоры → шлюз выхода → финиш ---------- */
  function plan(from, to) {
    const keys = Object.keys(nodes);
    const est = (km) => (km * C.ROAD_EST_DETOUR) / C.V_ROAD * 60;
    const cor = (km) => (km / C.V_COR) * 60;
    const all = ['S', 'E', ...keys];
    const dist = {}, prev = {}, done = new Set();
    all.forEach((k) => (dist[k] = Infinity));
    dist.S = 0;

    const neighbours = (u) => {
      if (u === 'S') {
        return keys
          .map((k) => ({ v: k, c: est(geo.hav(from, nodes[k].ll)) + C.GATE_MIN }))
          .concat([{ v: 'E', c: est(geo.hav(from, to)) }]);
      }
      return adj[u]
        .map((e) => ({ v: e.a === u ? e.b : e.a, c: cor(e.km) }))
        .concat([{ v: 'E', c: est(geo.hav(nodes[u].ll, to)) }]);
    };

    for (;;) {
      let u = null, best = Infinity;
      for (const k of all) if (!done.has(k) && dist[k] < best) { best = dist[k]; u = k; }
      if (u === null || u === 'E') break;
      done.add(u);
      for (const { v, c } of neighbours(u)) {
        if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; }
      }
    }

    const path = [];
    let cur = 'E';
    while (prev[cur] && prev[cur] !== 'S') { cur = prev[cur]; path.unshift(cur); }
    return path.length >= 2 ? path : [];
  }

  /** Текущая геометрия в формате js/data/corridors.js — для пересборки вшитого файла. */
  function exportGeometry() {
    const round = (p) => [+p[0].toFixed(5), +p[1].toFixed(5)];
    const out = { nodes: {}, edges: {} };
    for (const k in nodes) out.nodes[k] = round(nodes[k].ll);
    edges.forEach((e) => { if (e.raw) out.edges[e.a + '|' + e.b] = e.raw.map(round); });
    return out;
  }

  GIR.net = { nodes, lines, edges, coordsOf, lineOf, hubs, totalKm, lineKm, load, plan, exportGeometry, isSnapped: () => snapped };
})();
