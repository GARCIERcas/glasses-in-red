/* Состояние приложения и реестры экранов/действий. */
GIR.screens = {};
GIR.actions = {};

GIR.state = {
  view: 'home',
  from: GIR.location.place(),
  to: null,
  field: 'to',      // какое поле редактируется в поиске
  query: '',
  pick: null,       // выбор точки на карте: 'from' | 'to'
  tariff: 'single',
  pay: GIR.store.get('pay', 'card'),
  sub: GIR.store.get('sub', null),
  trips: GIR.store.get('trips', []),
  route: null,
  ride: null,
  follow: true      // карта следует за велосипедистом
};

GIR.subActive = () => {
  const s = GIR.state.sub;
  return !!(s && new Date(s.until) > new Date());
};
