/* SVG-иконки интерфейса и стрелки манёвров. */
(function () {
  const svg = (inner, sw = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  GIR.I = {
    menu: svg('<path d="M4 7h16M4 12h16M4 17h10"/>', 2.2),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 2.4),
    back: svg('<path d="M15 18l-6-6 6-6"/>', 2.4),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 2.4),
    locate: svg('<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>'),
    layers: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
    home: svg('<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    edu: svg('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>'),
    park: svg('<path d="M12 22v-6M7 16h10l-3-4h2l-4-6-4 6h2z"/>'),
    metro: svg('<path d="M3 19h4l5-10 5 10h4M7 19 12 7"/>', 2.2),
    city: svg('<path d="M4 21V8l5-3v16M9 21V3l6 3v15M15 21v-9l5 2v7M2 21h20"/>'),
    train: svg('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>'),
    pin: svg('<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
    map: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    snow: svg('<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>'),
    crown: svg('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
    wrench: svg('<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.4-6.4M14.7 6.3 13 4.6a4 4 0 0 0-5.6 5.6L9 11.8l-6 6L6 21l6-6"/>', 2.2),
    nfc: svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/><path d="M9.5 8.5a3.5 3.5 0 0 1 5 0M8 6.5a6 6 0 0 1 8 0"/>'),
    check: svg('<path d="M5 12l5 5L20 7"/>', 3),
    history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
    card: svg('<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    exit: svg('<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'),
    list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
    tire: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>'),
    chain: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
    brake: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'),
    help: svg('<path d="M12 21s-8-4.5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6.5-8 11-8 11z"/><path d="M12 9v4M10 11h4"/>'),
    gate: svg('<path d="M5 21V9M10 21V9M14 21V9M19 21V9M3 21h18M3 5.5h18"/>', 2.2),
    bike: svg('<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M15 6h2l1.5 11M5.5 17l4-7h7M9.5 10 8 6H6"/>'),
    cup: svg('<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5c-.6 1 .6 2 0 3M12 2.5c-.6 1 .6 2 0 3"/>'),
    food: svg('<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4-3.5 8h3.5"/>'),
    beer: svg('<path d="M6 7h10v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 7a3 3 0 0 1 3-4c1 0 1.7.4 2.2 1A3 3 0 0 1 16 7M9.5 11v6M12.5 11v6"/>'),
    museum: svg('<path d="M3 21h18M4 10h16M12 3 3 8h18zM6 10v8M10 10v8M14 10v8M18 10v8"/>'),
    film: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
    cart: svg('<path d="M3 4h2l2.5 11h10.5l2-8H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>'),
    gift: svg('<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4s.5 4 4 4zm0 0s1.5-5 4-4-.5 4-4 4z"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
    chevron: svg('<path d="m9 6 6 6-6 6"/>', 2.2),
    navArrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19.5 21 12 16.8 4.5 21z" fill="#fff"/></svg>',
    logo: svg('<circle cx="7" cy="13" r="3.5"/><circle cx="17" cy="13" r="3.5"/><path d="M10.5 13h3M3.5 13 2 10M20.5 13 22 10"/>', 2.2)
  };

  /* Стрелки манёвров: базовые формы «направо», левые — зеркально. */
  const M = {
    straight: '<path d="M12 21V4.5M6 10.5l6-6 6 6"/>',
    right: '<path d="M7 21v-7.5A3.5 3.5 0 0 1 10.5 10H19M15 6l4 4-4 4"/>',
    slight: '<path d="M9 21v-6.5c0-1 .4-1.9 1.1-2.6L17 5M12 5h5v5"/>',
    sharp: '<path d="M8 3v10.5a3 3 0 0 0 5.1 2.1L18.5 10M18.5 16v-6h-6"/>',
    uturn: '<path d="M16 21V9.5a4 4 0 0 0-8 0V16M4.5 12.5 8 16l3.5-3.5"/>',
    round: '<circle cx="12" cy="9" r="4"/><path d="M12 13v8M15 6l3.5-3.5M18.5 7V2.5H14"/>',
    arrive: '<path d="M6 21V4h11l-2 4 2 4H6"/>',
    gate: '<path d="M5 21V9M10 21V9M14 21V9M19 21V9M3 21h18M3 5.5h18"/>'
  };
  const big = (inner) => svg(inner, 2.4);
  const mirror = (p) => `<g transform="translate(24 0) scale(-1 1)">${p}</g>`;

  GIR.maneuverIcon = (kind, mod) => {
    if (kind === 'arrive') return big(M.arrive);
    if (kind === 'gate') return big(M.gate);
    if (kind === 'roundabout') return big(M.round);
    mod = mod || 'straight';
    if (mod === 'straight') return big(M.straight);
    if (mod === 'uturn') return big(M.uturn);
    const base = mod.includes('slight') ? M.slight : mod.includes('sharp') ? M.sharp : M.right;
    return big(mod.includes('left') ? mirror(base) : base);
  };
})();
