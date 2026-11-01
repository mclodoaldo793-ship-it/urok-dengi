/* ================= COFFEE BATTLE: shared rules (presenter + phones) ================= */
const COFFEE = {
  START: 1000,
  PRICES: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
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
  /* n — сколько человек захотят кофе (на обе кофейни), cost — во что обходится чашка, max — дороже никто не купит.
     Командам показывают только cost и текст новости: n и max они угадывают сами */
  EVENTS: {
    normal:   { e:'☕', t:'Обычный понедельник', n:60, cost:20, max:80,
                x:'Пары как всегда: обычный поток студентов, обычные кошельки.' },
    frost:    { e:'🥶', t:'Мороз −25°', n:90, cost:20, max:90,
                x:'Все хотят согреться. Покупателей намного больше обычного, за горячее готовы отдать чуть больше.' },
    session:  { e:'📚', t:'Сессия', n:120, cost:20, max:120,
                x:'Студенты не спят ночами. Кофе нужен всем, и за ценой никто не постоит.' },
    holidays: { e:'🏖️', t:'Каникулы', n:30, cost:20, max:60,
                x:'Колледж почти пустой, а у тех, кто пришёл, мало денег.' },
    beans:    { e:'📈', t:'Зёрна подорожали', n:60, cost:40, max:90,
                x:'Кофе везут из Бразилии и платят за него долларами. Доллар вырос — чашка теперь обходится в 40 ₽. Студенты слышали про подорожание и готовы платить немного больше.' },
    rain:     { e:'🌧️', t:'Ливень', n:42, cost:20, max:80,
                x:'Никто не хочет выходить из здания. Покупателей меньше обычного.' },
    stipend:  { e:'💸', t:'Пришла стипендия', n:72, cost:20, max:110,
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
/* t: { cards:{id:true|false} }  ev: { cost }  init: last order  on: { change(order) } */
function coffeeForm(host, t, ev, init, on) {
  const C = COFFEE;
  const o = { price: 60, card: null };
  if (init) ['price', 'card'].forEach(k => { if (k in init) o[k] = init[k]; });
  const fix = () => { if (o.card && !t.cards[o.card]) o.card = null; };
  function render() {
    fix();
    const ids = Object.keys(C.CARDS), unit = ev.cost - (o.card === 'discount' ? C.DISCOUNT : 0);
    const card = id => {
      const c = C.CARDS[id], used = !t.cards[id];
      return `<button type="button" class="cf-c ${c.good ? 'good' : 'evil'} ${o.card === id ? 'on' : ''} ${used ? 'used' : ''}" data-card="${id}" ${used ? 'disabled' : ''}><span>${c.e}</span><b>${c.n}</b><small>${used ? 'Уже сыграна' : c.d}</small></button>`;
    };
    const col = (good, title) => `<div class="cf-col ${good ? 'good' : 'evil'}"><span class="cf-g">${title}</span>${ids.filter(id => C.CARDS[id].good === good).map(card).join('')}</div>`;
    const left = o.price - unit;
    const note = left > 0 ? `С каждой чашки останется <b>${left} ₽</b>: цена ${o.price} ₽ минус ${unit} ₽ на кофе`
      : left === 0 ? `С чашки не останется <b>ничего</b>: цена ${o.price} ₽ и кофе обходится в ${unit} ₽`
      : `Каждая чашка <b class="bad">в убыток на ${-left} ₽</b>: цена ${o.price} ₽, а кофе обходится в ${unit} ₽`;
    host.innerHTML = `<div class="cf">
      <p class="cf-goal">Выберите <b>цену чашки</b>. Карту можно не брать.</p>
      <div class="cf-sec"><div class="cf-t"><i>1</i><span>Цена чашки <em>· сколько готовы платить покупатели, решайте сами</em></span></div>
        <div class="cf-prices">${C.PRICES.map(p => `<button type="button" class="cf-p ${p === o.price ? 'on' : ''}" data-p="${p}">${p} ₽</button>`).join('')}</div>
        <p class="cf-note">${note}</p></div>
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
