/* Поиск адресов и мест в Москве (Photon, данные OpenStreetMap). */
(function () {
  const C = GIR.config;

  const ICONS = {
    university: 'edu', college: 'edu', school: 'edu',
    park: 'park', garden: 'park',
    station: 'train', subway_entrance: 'metro', halt: 'metro'
  };

  function toPlace(f) {
    const p = f.properties;
    const addr = [p.street, p.housenumber].filter(Boolean).join(', ');
    const title = p.name || addr || p.district || 'Без названия';
    const sub = [p.name ? addr : '', p.district].filter(Boolean).join(' · ') || p.city || 'Москва';
    return {
      id: 'g' + p.osm_type + p.osm_id,
      n: title,
      s: sub,
      ll: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
      ic: ICONS[p.osm_value] || 'pin'
    };
  }

  let ctl = null;
  /** Ищет в пределах Москвы. Отменяет предыдущий незавершённый запрос. */
  async function search(q, near) {
    if (ctl) ctl.abort();
    ctl = new AbortController();
    const url = C.GEOCODER_URL + '?q=' + encodeURIComponent(q) + '&limit=8' +
      '&lat=' + near[0].toFixed(4) + '&lon=' + near[1].toFixed(4) + '&bbox=' + C.GEOCODER_BBOX;
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) return [];
      const j = await res.json();
      const seen = new Set();
      return (j.features || [])
        .filter((f) => !f.properties.city || f.properties.city === 'Москва')
        .map(toPlace)
        .filter((p) => { const k = p.n + p.s; if (seen.has(k)) return false; seen.add(k); return true; });
    } catch (e) {
      return e.name === 'AbortError' ? null : [];
    }
  }

  /** Адрес по координатам (для пикера на карте). */
  let rctl = null;
  async function reverse(ll) {
    if (rctl) rctl.abort();
    rctl = new AbortController();
    try {
      const res = await fetch(C.GEOCODER_URL.replace('/api/', '/reverse') + '?lat=' + ll[0].toFixed(6) + '&lon=' + ll[1].toFixed(6) + '&limit=1', { signal: rctl.signal });
      if (!res.ok) return null;
      const j = await res.json();
      return j.features && j.features[0] ? toPlace(j.features[0]) : null;
    } catch (e) {
      return e.name === 'AbortError' ? undefined : null;
    }
  }

  /* ---------- места по категории рядом: обратный геокодер Photon с фильтром по тегу OSM ----------
     (ищет ближайшие объекты вокруг точки — около секунды, без отдельного сервера) */
  const catCache = {};
  async function nearby(cat, near, radiusKm) {
    const url = C.GEOCODER_URL.replace('/api/', '/reverse') + '?lat=' + near[0].toFixed(5) + '&lon=' + near[1].toFixed(5) +
      '&osm_tag=' + cat.tag.join(':') + '&limit=20&radius=' + radiusKm;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) return [];
      const j = await res.json();
      return (j.features || []).map(toPlace).map((p) => Object.assign(p, { ic: cat.ic, s: p.s === 'Москва' ? cat.n : p.s }));
    } catch (e) {
      return [];
    } finally {
      clearTimeout(t);
    }
  }
  /** До 20 ближайших мест категории, отсортированных по расстоянию. */
  async function category(cat, near) {
    const key = cat.id + near.map((x) => x.toFixed(3)).join();
    if (catCache[key]) return catCache[key];
    let list = await nearby(cat, near, 2);
    if (list.length < 5) list = list.concat(await nearby(cat, near, 5)); // мало мест рядом — расширяем радиус
    const seen = new Set();
    list = list
      .filter((p) => { if (!p.n || p.n === 'Без названия' || seen.has(p.n)) return false; seen.add(p.n); return true; })
      .map((p) => Object.assign(p, { d: GIR.geo.hav(near, p.ll) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 20);
    if (list.length) catCache[key] = list;
    return list;
  }
  GIR.geocoder = { search, reverse, category };
})();
