/* Геометрия: расстояния, азимуты, точка на линии, тип поворота. Координаты — [lat, lng], расстояния — км. */
(function () {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const deg = (x) => (x * 180) / Math.PI;

  function hav(a, b) {
    const dLat = rad(b[0] - a[0]);
    const dLng = rad(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function bearing(a, b) {
    const f1 = rad(a[0]), f2 = rad(b[0]), dl = rad(b[1] - a[1]);
    const y = Math.sin(dl) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }

  function cumulative(coords) {
    const c = [0];
    for (let i = 1; i < coords.length; i++) c.push(c[i - 1] + hav(coords[i - 1], coords[i]));
    return c;
  }

  const lengthKm = (coords) => cumulative(coords)[coords.length - 1] || 0;

  /** Точка на полилинии на расстоянии km от начала. */
  function pointAt(coords, cum, km) {
    const n = coords.length;
    if (n < 2) return { ll: coords[0], i: 0, heading: 0 };
    km = Math.max(0, Math.min(cum[n - 1], km));
    let lo = 1, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < km) lo = mid + 1; else hi = mid;
    }
    const a = coords[lo - 1], b = coords[lo];
    const seg = cum[lo] - cum[lo - 1];
    const f = seg > 0 ? (km - cum[lo - 1]) / seg : 0;
    return { ll: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], i: lo, heading: bearing(a, b) };
  }

  /** Часть полилинии от начала до km. */
  function sliceTo(coords, cum, km) {
    const p = pointAt(coords, cum, km);
    return coords.slice(0, p.i).concat([p.ll]);
  }

  /** Тип поворота по смене азимута (как modifier в OSRM). */
  function turnModifier(bIn, bOut) {
    const d = ((bOut - bIn + 540) % 360) - 180; // >0 — направо
    const a = Math.abs(d);
    if (a < 25) return 'straight';
    if (a < 55) return d > 0 ? 'slight right' : 'slight left';
    if (a < 130) return d > 0 ? 'right' : 'left';
    if (a < 165) return d > 0 ? 'sharp right' : 'sharp left';
    return 'uturn';
  }

  GIR.geo = { hav, bearing, cumulative, lengthKm, pointAt, sliceTo, turnModifier };
})();
