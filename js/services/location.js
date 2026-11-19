/* Геопозиция: по умолчанию демо-точка у Таганской площади.
   По кнопке «Где я» пробуем настоящий GPS — если вы в Москве, берём его. */
(function () {
  const C = GIR.config;
  const inMoscow = ([la, lo]) => la > 55.55 && la < 55.95 && lo > 37.3 && lo < 37.9;

  const loc = {
    ll: C.DEMO_LOCATION.slice(),
    demo: true,
    asked: false,

    place() {
      return {
        id: 'me',
        n: 'Моё местоположение',
        s: loc.demo ? 'Демо-геопозиция · Таганская площадь' : 'По данным GPS',
        ll: loc.ll,
        ic: 'locate'
      };
    },

    /** Запрашивает настоящий GPS. true — получили точку в Москве, false — остаёмся на демо. */
    request() {
      loc.asked = true;
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const ll = [p.coords.latitude, p.coords.longitude];
            if (!inMoscow(ll)) return resolve(false);
            loc.ll = ll;
            loc.demo = false;
            resolve(true);
          },
          () => resolve(false),
          { timeout: 6000, maximumAge: 60000 }
        );
      });
    }
  };

  GIR.location = loc;
})();
