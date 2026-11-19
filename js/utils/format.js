/* Форматирование чисел, времени и расстояний по-русски. */
GIR.fmt = {
  min(m) {
    m = Math.max(1, Math.round(m));
    if (m < 60) return m + ' мин';
    const h = Math.floor(m / 60), mm = m % 60;
    return h + ' ч' + (mm ? ' ' + mm + ' мин' : '');
  },

  km(km) {
    if (km < 1) return Math.max(10, Math.round((km * 1000) / 10) * 10) + ' м';
    return km.toFixed(1).replace('.', ',') + ' км';
  },

  /** Расстояние до манёвра — округляем, как навигатор. */
  dist(km) {
    const m = km * 1000;
    if (m < 15) return 'Сейчас';
    if (m < 100) return Math.round(m / 10) * 10 + ' м';
    if (m < 1000) return Math.round(m / 50) * 50 + ' м';
    return (km < 10 ? km.toFixed(1) : String(Math.round(km))).replace('.', ',') + ' км';
  },

  clock: (d) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  date: (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),

  plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
};
