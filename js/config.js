/* Общие настройки приложения. Все цифры — допущения прототипа. */
window.GIR = window.GIR || {};

GIR.config = {
  // Скорости, км/ч
  V_COR: 25,            // внутри коридора: без светофоров и спешиваний
  V_ROAD: 12,           // по обычным улицам: светофоры, бордюры, спешивания
  ROAD_EST_DETOUR: 1.5, // поправка «по прямой → по улицам» (в центре улицы петляют, реки, односторонки)
  GATE_MIN: 0.6,        // время на проезд шлюза, мин

  // Тарифы
  PRICE_SINGLE: 90,
  PRICE_SUB: 1500,
  SINGLE_HOURS: 2,

  // Симуляция поездки
  SIM_COR_KMPS: 0.2,    // скорость симуляции в коридоре при ×1, км в секунду
  SIM_ROAD_KMPS: 0.09,  // на улицах при ×1 (медленнее — чтобы успевать читать повороты)
  SIM_SPEEDS: [1, 2, 4],

  // Маршруты по улицам: Valhalla (бесплатный сервер FOSSGIS, данные OpenStreetMap)
  VALHALLA_URL: 'https://valhalla1.openstreetmap.de/route',
  ROUTE_TIMEOUT_MS: 7000,
  NET_CACHE_KEY: 'net-geom-v8', // кэш геометрии, если она не вшита в js/data/corridors.js
  GEOCODER_URL: 'https://photon.komoot.io/api/',
  GEOCODER_BBOX: '37.40,55.62,37.80,55.86', // Москва примерно в пределах МКАД

  // Карта: Яндекс Карты JS API 2.1. Для публикации получите бесплатный ключ
  // на https://developer.tech.yandex.ru (JavaScript API и HTTP Геокодер) и впишите сюда.
  YANDEX_API_KEY: '',
  MAP_CENTER: [55.752, 37.620],
  DEMO_LOCATION: [55.7397, 37.6566], // демо-геопозиция: Таганская площадь (если GPS недоступен или вы не в Москве)
  MAP_ZOOM: 13,
  RIDE_ZOOM: 16,

  USER_NAME: 'Вадим'
};
