/* Конец поездки: коротко — куда приехали, время, оценка. */
(function () {
  const S = GIR.state, F = GIR.fmt, I = GIR.I, esc = GIR.esc;

  function show(early) {
    const R = S.ride, r = S.route;
    S.view = 'finish';
    GIR.screens.ride.hideNav();

    const trip = {
      d: new Date().toISOString(),
      from: r.from.n,
      to: r.to.n,
      km: +R.km.toFixed(1),
      min: Math.max(1, Math.round(R.simMin)),
      corKm: r.corridor ? +Math.min(r.corridor.km, Math.max(0, R.km - r.corridor.startKm)).toFixed(1) : 0,
      price: R.price || 0
    };
    S.trips.unshift(trip);
    S.trips = S.trips.slice(0, 30);
    GIR.store.set('trips', S.trips);

    GIR.ui.sheet.set(`
      <div class="center">
        <div class="done-ico">${I.check}</div>
        <h2 class="title">${early ? 'Поездка завершена' : 'Вы на месте'}</h2>
        <p class="lead">${esc(r.to.n)} · ${F.min(trip.min)} · ${F.km(Math.max(0.01, trip.km))}</p>
      </div>
      <div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-act="rate" data-arg="${n}" aria-label="Оценка ${n}">★</button>`).join('')}</div>
      <button class="btn dark" data-act="endTrip">Готово</button>
    `);
    GIR.mapView.fit(r.coords);
    if (!early) confetti();
  }

  function confetti() {
    const colors = ['#E4002B', '#FF5A36', '#15171A', '#F5B400', '#1D5BEA'];
    const box = document.createElement('div');
    box.className = 'confetti';
    box.innerHTML = Array.from({ length: 36 }, (_, i) =>
      `<i style="--x:${(Math.random() * 100).toFixed(1)}vw;--dx:${(Math.random() * 120 - 60).toFixed(0)}px;--d:${(Math.random() * 0.5).toFixed(2)}s;--r:${Math.floor(Math.random() * 720 - 360)}deg;--c:${colors[i % colors.length]}"></i>`
    ).join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2800);
  }

  GIR.screens.finish = { show };
  Object.assign(GIR.actions, {
    rate(n) {
      document.querySelectorAll('#stars button').forEach((b, i) => b.classList.toggle('on', i < +n));
      GIR.ui.toast('Спасибо за оценку!');
    },
    endTrip() {
      S.ride = null;
      S.to = null;
      GIR.screens.home.show();
    }
  });
})();
