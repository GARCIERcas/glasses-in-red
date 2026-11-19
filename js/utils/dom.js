/* Мелкие помощники для DOM и хранилища. */
GIR.$ = (s) => document.querySelector(s);

GIR.esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* localStorage может быть недоступен (приватный режим) — тогда просто не запоминаем. */
GIR.store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('gir_' + k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('gir_' + k, JSON.stringify(v));
    } catch (e) { /* ignore */ }
  }
};
