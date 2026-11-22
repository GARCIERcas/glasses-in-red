/* Сборка маршрута из участков (legs):
   road (до шлюза) → corridor (красные коридоры) → road (от шлюза до цели).
   У каждого участка — геометрия, длина, время и шаги навигации. */
(function () {
  const C = GIR.config, geo = GIR.geo, net = GIR.net;
  const roadMin = (km) => (km / C.V_ROAD) * 60;
  const corMin = (km) => (km / C.V_COR) * 60;

  const TURN = {
    left: 'Поверните налево', right: 'Поверните направо',
    'slight left': 'Держитесь левее', 'slight right': 'Держитесь правее',
    'sharp left': 'Резко налево', 'sharp right': 'Резко направо',
    straight: 'Продолжайте прямо', uturn: 'Развернитесь'
  };
  const SHORT = {
    left: 'Налево', right: 'Направо', 'slight left': 'Левее', 'slight right': 'Правее',
    'sharp left': 'Резко налево', 'sharp right': 'Резко направо', straight: 'Прямо', uturn: 'Разворот'
  };

  const streetOf = (s) => s.name || s.ref || '';

  /** Шаги OSRM → понятные русские инструкции. */
  function roadSteps(raw, role, destName) {
    const out = [];
    for (const s of raw) {
      const t = s.type, m = s.mod;
      if (t === 'depart') {
        if (role !== 'exit') {
          out.push({ km: s.offsetKm, kind: 'turn', mod: 'straight', text: role === 'approach' ? 'Едем к шлюзу' : 'Начните движение', street: streetOf(s) });
        }
        continue;
      }
      if (t === 'arrive') {
        if (role !== 'approach') out.push({ km: s.offsetKm, kind: 'arrive', text: 'Вы на месте', street: destName });
        continue;
      }
      if ((t === 'continue' || t === 'new name' || t === 'notification' || t === 'use lane') && (!m || m === 'straight')) continue;
      if (t === 'exit roundabout' || t === 'exit rotary') continue;
      if (t === 'roundabout' || t === 'rotary' || t === 'roundabout turn') {
        out.push({ km: s.offsetKm, kind: 'roundabout', text: s.exit ? `Круговое движение, ${s.exit}-й съезд` : 'Круговое движение', street: streetOf(s) });
        continue;
      }
      out.push({ km: s.offsetKm, kind: 'turn', mod: m || 'straight', text: TURN[m] || 'Продолжайте движение', street: streetOf(s) });
    }
    // слишком частые манёвры (ближе 15 м) склеиваем
    const res = [];
    for (const s of out) {
      const p = res[res.length - 1];
      if (p && s.kind !== 'arrive' && s.km - p.km < 0.015) continue;
      res.push(s);
    }
    return res;
  }

  function roadLeg(raw, role, destName) {
    const km = geo.lengthKm(raw.coords);
    return {
      type: 'road', role, ok: raw.ok, coords: raw.coords, km,
      min: roadMin(raw.ok ? km : km * C.ROAD_EST_DETOUR),
      steps: roadSteps(raw.steps, role, destName)
    };
  }

  function corridorLeg(gates) {
    const N = net.nodes, L = net.lines;
    const coords = [], nodeKms = [0];
    let km = 0;
    for (let i = 0; i < gates.length - 1; i++) {
      for (const p of net.coordsOf(gates[i], gates[i + 1])) {
        if (coords.length) {
          const d = geo.hav(coords[coords.length - 1], p);
          if (d < 0.0005) continue;
          km += d;
        }
        coords.push(p);
      }
      nodeKms.push(km);
    }
    const cum = geo.cumulative(coords);

    const lines = [];
    for (let i = 0; i < gates.length - 1; i++) {
      const l = net.lineOf(gates[i], gates[i + 1]);
      if (!lines.includes(l)) lines.push(l);
    }

    const steps = [{
      km: 0, kind: 'gate',
      text: `Въезд через шлюз «${N[gates[0]].n}»`,
      street: 'Коридор «' + L[lines[0]].name + '»'
    }];
    for (let i = 1; i < gates.length - 1; i++) {
      const lin = net.lineOf(gates[i - 1], gates[i]);
      const lout = net.lineOf(gates[i], gates[i + 1]);
      if (lin === lout) continue;
      const nk = nodeKms[i];
      // направление считаем по отрезкам в стороне от узла — у самого шлюза геометрия может петлять
      const at = (d) => geo.pointAt(coords, cum, Math.max(0, Math.min(km, nk + d))).ll;
      let mod = geo.turnModifier(geo.bearing(at(-0.4), at(-0.08)), geo.bearing(at(0.08), at(0.4)));
      if (mod === 'uturn') mod = 'sharp right'; // разворотов внутри сети нет — это артефакт геометрии
      steps.push({
        km: nk, kind: 'switch', mod,
        text: `${SHORT[mod]} на коридор «${L[lout].name}»`,
        street: `Развязка у шлюза «${N[gates[i]].n}»`
      });
    }
    steps.push({
      km, kind: 'gate',
      text: `Выезд через шлюз «${N[gates[gates.length - 1]].n}»`,
      street: 'Дальше по улицам'
    });

    return { type: 'corridor', coords, km, nodeKms, gates, lines, steps, min: corMin(km) + C.GATE_MIN };
  }

  /** Склеивает участки в один маршрут с абсолютными расстояниями шагов. */
  function assemble(r) {
    r.coords = [];
    r.steps = [];
    let km = 0;
    r.legs.forEach((leg, idx) => {
      leg.startKm = km;
      for (const p of leg.coords) {
        if (r.coords.length && geo.hav(r.coords[r.coords.length - 1], p) < 0.0005) continue;
        r.coords.push(p);
      }
      km += leg.km;
      leg.endKm = km;
      leg.steps.forEach((s) => r.steps.push(Object.assign({}, s, { km: leg.startKm + s.km, leg: idx, type: leg.type })));
    });
    r.cum = geo.cumulative(r.coords);
    r.totalKm = r.cum[r.cum.length - 1];
    const last = r.legs[r.legs.length - 1];
    last.endKm = r.totalKm;
    if (!r.steps.length || r.steps[r.steps.length - 1].kind !== 'arrive') {
      r.steps.push({ km: r.totalKm, kind: 'arrive', text: 'Вы на месте', street: r.to.n, leg: r.legs.length - 1, type: last.type });
    }
    r.steps.sort((a, b) => a.km - b.km);
    r.totalMin = r.legs.reduce((s, l) => s + l.min, 0);
    r.saved = Math.max(0, Math.round(r.regularMin - r.totalMin));
    r.corridor = r.legs.find((l) => l.type === 'corridor') || null;
    r.approx = r.legs.some((l) => l.type === 'road' && !l.ok);
    return r;
  }

  async function build(from, to) {
    const N = net.nodes;
    const gates = net.plan(from.ll, to.ll);
    const directP = GIR.roads.road(from.ll, to.ll);

    if (!gates.length) {
      const d = await directP;
      const leg = roadLeg(d, 'direct', to.n);
      return assemble({ from, to, none: true, legs: [leg], regularKm: leg.km, regularMin: leg.min });
    }

    const [a, d, e] = await Promise.all([
      GIR.roads.road(from.ll, N[gates[0]].ll),
      directP,
      GIR.roads.road(N[gates[gates.length - 1]].ll, to.ll)
    ]);
    const legs = [];
    const A = roadLeg(a, 'approach', to.n);
    if (A.km > 0.02) legs.push(A);
    legs.push(corridorLeg(gates));
    const E = roadLeg(e, 'exit', to.n);
    if (E.km > 0.02) legs.push(E);

    const direct = roadLeg(d, 'direct', to.n);
    const r = assemble({ from, to, legs, regularKm: direct.km, regularMin: direct.min });
    // если по улицам заметно быстрее даже с учётом светофоров — честно ведём по улицам
    if (d.ok && direct.min < r.totalMin * 0.85) {
      return assemble({ from, to, none: true, legs: [direct], regularKm: direct.km, regularMin: direct.min });
    }
    return r;
  }

  /** «Сойти с коридора»: выезд через ближайший шлюз впереди, дальше — по дорогам до цели.
      Возвращает имя шлюза выезда или null, если следующий шлюз и так последний. */
  async function leave(r, km) {
    const ci = r.legs.findIndex((l) => l.type === 'corridor');
    if (ci < 0) return null;
    const cor = r.legs[ci];
    const local = km - cor.startKm;
    if (local < 0) return null;
    const j = cor.nodeKms.findIndex((nk) => nk > local + 0.05);
    if (j < 0 || j >= cor.gates.length - 1) return null;

    const gates = cor.gates.slice(0, j + 1);
    const exitGate = gates[gates.length - 1];
    const raw = await GIR.roads.road(net.nodes[exitGate].ll, r.to.ll);
    r.legs = r.legs.slice(0, ci).concat([corridorLeg(gates), roadLeg(raw, 'exit', r.to.n)]);
    assemble(r);
    return net.nodes[exitGate].n;
  }

  /** Сколько минут осталось ехать с позиции km. */
  function remainingMin(r, km) {
    return r.legs.reduce((s, l) => {
      const left = Math.max(0, Math.min(l.endKm, r.totalKm) - Math.max(km, l.startKm));
      return s + (l.km > 0 ? (left / l.km) * l.min : 0);
    }, 0);
  }

  const legAt = (r, km) => r.legs.find((l) => km >= l.startKm - 1e-6 && km < l.endKm) || r.legs[r.legs.length - 1];

  GIR.planner = { build, leave, remainingMin, legAt };
})();
