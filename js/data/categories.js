/* Категории мест «куда поехать» — как на главной Яндекс Карт.
   tag — тег OpenStreetMap для Overpass, q — запасной текстовый запрос для Photon. */
GIR.data.categories = [
  { id: 'cafe',    n: 'Кафе',       tag: ['amenity', 'cafe'],          q: 'кафе',        ic: 'cup',      color: '#F08A24' },
  { id: 'food',    n: 'Рестораны',  tag: ['amenity', 'restaurant'],    q: 'ресторан',    ic: 'food',     color: '#E4002B' },
  { id: 'bar',     n: 'Бары',       tag: ['amenity', 'bar'],           q: 'бар',         ic: 'beer',     color: '#9B51E0' },
  { id: 'park',    n: 'Парки',      tag: ['leisure', 'park'],          q: 'парк',        ic: 'park',     color: '#20A464' },
  { id: 'museum',  n: 'Музеи',      tag: ['tourism', 'museum'],        q: 'музей',       ic: 'museum',   color: '#3B6FE0' },
  { id: 'cinema',  n: 'Кино',       tag: ['amenity', 'cinema'],        q: 'кинотеатр',   ic: 'film',     color: '#D0368A' },
  { id: 'shop',    n: 'Продукты',   tag: ['shop', 'supermarket'],      q: 'супермаркет', ic: 'cart',     color: '#0FA3A3' },
  { id: 'bike',    n: 'Велосервис', tag: ['shop', 'bicycle'],          q: 'велосипед',   ic: 'bike',     color: '#4A5060' }
];
