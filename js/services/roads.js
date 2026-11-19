/* Маршруты по обычным улицам через Valhalla (сервер FOSSGIS, данные OpenStreetMap).
   Если сервер не ответил — отдаём прямую линию, а интерфейс помечает маршрут как примерный. */
(function () {
  const C = GIR.config, geo = GIR.geo;

  /** Декодирует polyline с точностью 6 знаков (формат Valhalla) в [[lat, lng], …]. */
  function decode(str) {
    const out = [];
    let i = 0, lat = 0, lng = 0;
    while (i < str.length) {
      for (const which of [0, 1]) {
        let result = 0, shift = 0, b;
        do {
          b = str.charCodeAt(i++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const d = result & 1 ? ~(result >> 1) : result >> 1;
        if (which === 0) lat += d; else lng += d;
      }
      out.push([lat / 1e6, lng / 1e6]);
    }
    return out;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function request(points, costing, attempt = 0) {
    const body = {
      locations: points.map((p, i) => ({
        lat: +p[0].toFixed(6), lon: +p[1].toFixed(6),
        type: i === 0 || i === points.length - 1 ? 'break' : 'break_through'
      })),
      costing,
      costing_options: { bicycle: { bicycle_type: 'Hybrid', use_roads: 0.5 } },
      language: 'ru-RU',
      directions_options: { units: 'kilometers' }
    };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), C.ROUTE_TIMEOUT_MS);
    try {
      const res = await fetch(C.VALHALLA_URL + '?json=' + encodeURIComponent(JSON.stringify(body)), { signal: ctl.signal });
      if (res.status === 429 && attempt < 2) { clearTimeout(timer); await sleep(1100 * (attempt + 1)); return request(points, costing, attempt + 1); }
      if (!res.ok) return null;
      const j = await res.json();
      return (j.trip && j.trip.legs && j.trip.legs.length) ? j.trip : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /* Тип манёвра Valhalla → наш формат (как в OSRM: type + modifier) */
  const MOD = {
    9: 'slight right', 10: 'right', 11: 'sharp right', 12: 'uturn', 13: 'uturn',
    14: 'sharp left', 15: 'left', 16: 'slight left', 18: 'slight right', 19: 'slight left',
    20: 'slight right', 21: 'slight left', 23: 'slight right', 24: 'slight left'
  };
  function maneuver(m) {
    const t = m.type;
    if (t >= 1 && t <= 3) return { type: 'depart' };
    if (t >= 4 && t <= 6) return { type: 'arrive' };
    if (t === 26) return { type: 'roundabout', exit: m.roundabout_exit_count };
    if (t === 27) return { type: 'exit roundabout' };
    return MOD[t] ? { type: 'turn', mod: MOD[t] } : { type: 'continue', mod: 'straight' };
  }

  function legGeometry(leg) {
    const coords = decode(leg.shape);
    const cum = geo.cumulative(coords);
    const steps = leg.maneuvers.map((m) => Object.assign(
      { offsetKm: cum[Math.min(m.begin_shape_index, cum.length - 1)], name: (m.street_names || [])[0] || '' },
      maneuver(m)
    ));
    return { coords, steps };
  }

  function straight(a, b) {
    return {
      ok: false,
      coords: [a, b],
      steps: [{ offsetKm: 0, type: 'depart' }, { offsetKm: geo.hav(a, b), type: 'arrive' }]
    };
  }

  /** Маршрут a → b по улицам: { ok, coords, steps }. Начинается ровно в a и заканчивается в b. */
  async function road(a, b) {
    // Пешеходная сеть: велопрофиль соблюдает все односторонние улицы и в центре даёт крюки в 3–5 раз
    const trip = await request([a, b], 'pedestrian');
    if (!trip) return straight(a, b);
    const g = legGeometry(trip.legs[0]);
    if (g.coords.length < 2) return straight(a, b);

    const d0 = geo.hav(a, g.coords[0]);
    if (d0 > 0.003) {
      g.coords.unshift(a);
      g.steps.forEach((s, i) => { if (i > 0) s.offsetKm += d0; });
    }
    const d1 = geo.hav(g.coords[g.coords.length - 1], b);
    if (d1 > 0.003) {
      g.coords.push(b);
      const last = g.steps[g.steps.length - 1];
      if (last && last.type === 'arrive') last.offsetKm += d1;
    }
    return { ok: true, coords: g.coords, steps: g.steps };
  }

  /** Геометрия цепочки шлюзов (запасной путь, если коридоры не вшиты в проект). */
  async function chain(points) {
    const trip = await request(points, 'pedestrian');
    if (!trip) return null;
    const legs = trip.legs.map((l) => decode(l.shape));
    const snapped = legs.map((c) => c[0]).concat([legs[legs.length - 1][legs[legs.length - 1].length - 1]]);
    return { legs, snapped };
  }

  GIR.roads = { road, chain, decode };
})();
