/* ================= COFFEE BATTLE: shared rules (presenter + phones) ================= */
const COFFEE = {
  START: 1000,
  PRICES: [40, 60, 80, 100],
  AD: 10, RUMOR: 10, DISCOUNT: 10, POWER_CAP: 20,
  TAX: .3,
  EMOJI: ['☕', '🧋', '🍩', '🥐', '🧁', '🍪', '🥤', '🍫'],
  CARDS: {
    ad:       { e:'📣', n:'Реклама',            good:true,  d:'К вам придут ещё 10 покупателей' },
    discount: { e:'🚚', n:'Скидка на зёрна',    good:true,  d:'Чашка обойдётся вам на 10 ₽ дешевле' },
    shield:   { e:'🛡️', n:'Охрана',             good:true,  d:'Пакости соперника не сработают' },
    rumor:    { e:'🪳', n:'Слух про таракана',  good:false, d:'10 его покупателей перейдут к вам' },
    tax:      { e:'🧾', n:'Налоговая проверка', good:false, d:'Соперник отдаст 30% выручки' },
    power:    { e:'🔌', n:'Отключили свет',     good:false, d:'Соперник продаст не больше 20 чашек' }
  },
  /* n — сколько человек захотят кофе (на обе кофейни), cost — во что обходится чашка, max — дороже никто не купит */
  EVENTS: {
    normal:   { e:'☕', t:'Обычный понедельник', n:60, cost:20, max:80,
                x:'Пары как всегда, обычный поток студентов.' },
    frost:    { e:'🥶', t:'Мороз −25°', n:90, cost:20, max:80,
                x:'Все хотят согреться. Покупателей намного больше обычного.' },
    session:  { e:'📚', t:'Сессия', n:120, cost:20, max:100,
                x:'Студенты не спят ночами. Кофе нужен всем, его купят даже за 100 ₽.' },
    holidays: { e:'🏖️', t:'Каникулы', n:30, cost:20, max:60,
                x:'Колледж почти пустой, а у тех, кто пришёл, мало денег.' },
    beans:    { e:'📈', t:'Зёрна подорожали', n:60, cost:40, max:80,
                x:'Кофе везут из Бразилии и платят за него долларами. Доллар вырос — чашка теперь обходится в 40 ₽.' },
    rain:     { e:'🌧️', t:'Ливень', n:42, cost:20, max:80,
                x:'Никто не хочет выходить из здания. Покупателей меньше обычного.' },
    stipend:  { e:'💸', t:'Пришла стипендия', n:72, cost:20, max:100,
                x:'У студентов появились деньги. Покупателей больше, и дорогой кофе их не пугает.' },
    blogger:  { e:'📱', t:'Блогер против кофе', n:42, cost:20, max:60,
                x:'Популярный блогер сказал, что кофе вреден. Покупателей меньше, и платить много никто не хочет.' },
    cups:     { e:'🥤', t:'Оптовая скидка', n:60, cost:10, max:80,
                x:'Поставщик устроил распродажу зёрен и стаканчиков. Чашка обходится всего в 10 ₽.' },
    festival: { e:'🎉', t:'День студента', n:90, cost:20, max:100,
                x:'Праздник! В колледже концерт, кофе хотят почти все.' }
  }
};
/* the one market rule: the cheaper shop gets 2 of every 3 people, equal prices split in half */
const coffeeSplit = (n, mine, theirs) => mine < theirs ? Math.round(n * 2 / 3) : mine > theirs ? n - Math.round(n * 2 / 3) : n / 2;

/* ---------- order form: the same on the captain's phone and in the presenter's manual-entry window ---------- */
/* t: { cards:{id:true|false} }  ev: { n, cost, max }  init: last order  on: { change(order) } */
function coffeeForm(host, t, ev, init, on) {
  const C = COFFEE;
  const money = n => (n < 0 ? '−' : '+') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  const o = { price: 60, card: null };
  if (init) ['price', 'card'].forEach(k => { if (k in init) o[k] = init[k]; });
  const fix = () => {
    if (o.price > ev.max) o.price = ev.max;
    if (o.card && !t.cards[o.card]) o.card = null;
  };
  /* what the team earns at its price for each guess about the rival: ready answers, no maths left for the class */
  function outcomes(unit) {
    const extra = (o.card === 'ad' ? C.AD : 0) + (o.card === 'rumor' ? C.RUMOR : 0), cases = [];
    if (o.price > C.PRICES[0]) cases.push(['Соперник дешевле', o.price - 20]);
    cases.push(['Цены равные', o.price]);
    if (o.price < ev.max) cases.push(['Соперник дороже', o.price + 20]);
    return cases.map(([s, rival]) => {
      const b = coffeeSplit(ev.n, o.price, rival) + extra;
      return `<div class="cf-o"><small>${s}</small><b>${money(b * (o.price - unit))}</b><span>${b} ${plural(b, 'покупатель', 'покупателя', 'покупателей')}</span></div>`;
    }).join('');
  }
  function render() {
    fix();
    const ids = Object.keys(C.CARDS), unit = ev.cost - (o.card === 'discount' ? C.DISCOUNT : 0);
    const card = id => {
      const c = C.CARDS[id], used = !t.cards[id];
      return `<button type="button" class="cf-c ${c.good ? 'good' : 'evil'} ${o.card === id ? 'on' : ''} ${used ? 'used' : ''}" data-card="${id}" ${used ? 'disabled' : ''}><span>${c.e}</span><b>${c.n}</b><small>${used ? 'Уже сыграна' : c.d}</small></button>`;
    };
    const col = (good, title) => `<div class="cf-col ${good ? 'good' : 'evil'}"><span class="cf-g">${title}</span>${ids.filter(id => C.CARDS[id].good === good).map(card).join('')}</div>`;
    host.innerHTML = `<div class="cf">
      <p class="cf-goal">Выберите <b>цену чашки</b>. Карту можно не брать.</p>
      <div class="cf-sec"><div class="cf-t"><i>1</i>Цена чашки</div>
        <div class="cf-prices">${C.PRICES.map(p => `<button type="button" class="cf-p ${p === o.price ? 'on' : ''}" data-p="${p}" ${p > ev.max ? 'disabled' : ''}>${p} ₽${p > ev.max ? '<small>не купят</small>' : ''}</button>`).join('')}</div>
        <p class="cf-note">С каждой чашки останется <b>${o.price - unit} ₽</b>: цена ${o.price} ₽ минус ${unit} ₽ на кофе</p>
        <div class="cf-outs"><span>Сколько заработаете за раунд:</span><div>${outcomes(unit)}</div></div></div>
      <div class="cf-sec"><div class="cf-t"><i>2</i><span>Карта <em>· по желанию, каждая — один раз за игру</em></span></div>
        <div class="cf-cards">${col(true, 'Помощь себе')}${col(false, 'Пакость сопернику')}</div></div>
    </div>`;
  }
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !host.contains(b)) return;
    if (b.dataset.p) o.price = +b.dataset.p;
    else if (b.dataset.card) o.card = o.card === b.dataset.card ? null : b.dataset.card;
    else return;
    render(); on.change?.({ ...o });
  });
  render();
  return {
    get value() { fix(); return { ...o }; },
    update(nt, nev) { t = nt; if (nev) ev = nev; render(); }
  };
}
