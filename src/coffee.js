/* ================= COFFEE BATTLE: shared rules (presenter + phones) ================= */
const COFFEE = {
  START: 1000,
  PRICES: [40, 60, 80, 100],
  MAX_CUPS: 80,
  STEP: 10,
  /* доля желающих, которые купят кофе по такой цене */
  W: { 40: 1, 60: .9, 80: .75, 100: .6 },
  POWER_CAP: 20,
  TAX: .3,
  EMOJI: ['☕', '🧋', '🍩', '🥐', '🧁', '🍪', '🥤', '🍫'],
  CARDS: {
    ad:      { e:'📣', n:'Реклама',            good:true,  d:'К вам придёт больше покупателей' },
    insider: { e:'🕵️', n:'Инсайдер',           good:true,  d:'Узнаете точное число покупателей' },
    shield:  { e:'🛡️', n:'Охрана',             good:true,  d:'Пакости соперника не сработают' },
    rumor:   { e:'🪳', n:'Слух про таракана',  good:false, d:'Часть его покупателей уйдёт к вам' },
    tax:     { e:'🧾', n:'Налоговая проверка', good:false, d:'Соперник отдаст 30% выручки' },
    power:   { e:'🔌', n:'Отключили свет',     good:false, d:'Соперник сварит не больше 20 чашек' }
  },
  /* n — сколько людей вообще захотят кофе в этот день (на обе кофейни) */
  EVENTS: {
    normal:   { e:'☕', t:'Обычный понедельник', n:60, cost:20, lvl:'как обычно — около 60 человек',
                x:'Пары как всегда. Около 60 человек захотят кофе.' },
    frost:    { e:'🥶', t:'Мороз −25°', n:90, cost:20, lvl:'много',
                x:'Все хотят согреться. Покупателей намного больше обычного.' },
    session:  { e:'📚', t:'Сессия', n:110, cost:20, lvl:'очень много', w:{ 40:1, 60:1, 80:.9, 100:.8 },
                x:'Студенты не спят ночами. Кофе нужен всем, и даже дорогой их не пугает.' },
    holidays: { e:'🏖️', t:'Каникулы', n:25, cost:20, lvl:'очень мало',
                x:'Колледж почти пустой. Кофе захотят совсем немногие.' },
    beans:    { e:'📈', t:'Зёрна подорожали', n:60, cost:35, lvl:'как обычно',
                x:'Кофе везут из Бразилии и платят за него долларами. Доллар вырос — чашка теперь обходится в 35 ₽.' },
    rain:     { e:'🌧️', t:'Ливень', n:40, cost:20, lvl:'меньше обычного',
                x:'Никто не хочет выходить из здания. Покупателей меньше обычного.' },
    stipend:  { e:'💸', t:'Пришла стипендия', n:75, cost:20, lvl:'больше обычного', w:{ 40:1, 60:.95, 80:.85, 100:.7 },
                x:'У студентов появились деньги. Покупателей больше, и дорогой кофе их не так пугает.' },
    blogger:  { e:'📱', t:'Блогер против кофе', n:40, cost:20, lvl:'меньше обычного',
                x:'Популярный блогер сказал, что кофе вреден. Часть студентов поверила.' },
    cups:     { e:'🥤', t:'Оптовая скидка', n:60, cost:10, lvl:'как обычно',
                x:'Поставщик устроил распродажу стаканчиков и зёрен. Чашка обходится всего в 10 ₽.' },
    festival: { e:'🎉', t:'День студента', n:95, cost:20, lvl:'много',
                x:'Праздник! В колледже концерт, и кофе хотят почти все.' }
  }
};

/* ---------- order form: the same on the captain's phone and in the presenter's manual-entry window ---------- */
/* t: { money, cards:{id:true|false}, peek }  ev: { cost, w }  init: last order  on: { change(order), peek() } */
function coffeeForm(host, t, ev, init, on) {
  const C = COFFEE, w = ev.w || C.W;
  const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  const o = { price: 60, cups: 30, card: null };
  if (init) ['price', 'cups', 'card'].forEach(k => { if (k in init) o[k] = init[k]; });
  if (o.card && !t.cards[o.card]) o.card = null;
  let arm = false;  // Insider needs a second tap: it spends the card for this round
  const maxCups = () => Math.max(0, Math.min(C.MAX_CUPS, Math.floor(t.money / ev.cost / C.STEP) * C.STEP));
  const fix = () => { o.cups = Math.max(0, Math.min(o.cups, maxCups())); };
  /* three steps, each is buttons plus one plain line; the last line repeats the whole decision */
  function render() {
    fix();
    const peeked = t.peek != null, max = maxCups(), ids = Object.keys(C.CARDS);
    const card = id => {
      const c = C.CARDS[id];
      const used = !t.cards[id] && !(id === 'insider' && peeked);
      const sel = id === 'insider' ? peeked : o.card === id;
      const dis = used || (peeked && id !== 'insider') || (id === 'insider' && !peeked && !!o.card);
      const armed = id === 'insider' && arm && !peeked && !dis;
      return `<button type="button" class="cf-c ${c.good ? 'good' : 'evil'} ${sel || armed ? 'on' : ''} ${used ? 'used' : ''}" data-card="${id}" ${dis ? 'disabled' : ''}><span>${c.e}</span><b>${c.n}</b><small>${used ? 'Уже сыграна' : c.d}</small></button>`;
    };
    const col = (good, title) => `<div class="cf-col ${good ? 'good' : 'evil'}"><span class="cf-g">${title}</span>${ids.filter(id => C.CARDS[id].good === good).map(card).join('')}</div>`;
    let note = 'За раунд можно сыграть одну карту. Каждая карта — один раз за игру.';
    if (peeked) note = `🕵️ Кофе захотят <b>${t.peek}</b> человек на обе кофейни`;
    else if (arm) note = 'Нажмите «Инсайдер» ещё раз, и вы узнаете число покупателей. Это и будет карта раунда.';
    else if (o.card) note = `Карта «${C.CARDS[o.card].n}» сработает в этом раунде. Нажмите на неё ещё раз, чтобы отменить.`;
    const played = peeked ? 'insider' : o.card;
    host.innerHTML = `<div class="cf">
      <p class="cf-goal">Выберите <b>цену</b> и <b>сколько чашек сварить</b>. Карту можно не брать.</p>
      <div class="cf-pair">
        <div class="cf-sec"><div class="cf-t"><i>1</i>Цена чашки</div>
          <div class="cf-prices">${C.PRICES.map(p => `<button type="button" class="cf-p ${p === o.price ? 'on' : ''}" data-p="${p}">${p} ₽</button>`).join('')}</div>
          <p class="cf-note">По ${o.price} ₽ кофе купят ${Math.round(w[o.price] * 10)} из 10 желающих</p></div>
        <div class="cf-sec"><div class="cf-t"><i>2</i>Сколько чашек сварить</div>
          <div class="cf-cups"><button type="button" data-c="-10" ${o.cups <= 0 ? 'disabled' : ''} aria-label="Меньше">−</button><b>${o.cups}</b><button type="button" data-c="10" ${o.cups >= max ? 'disabled' : ''} aria-label="Больше">+</button></div>
          <p class="cf-note">Потратите <b>${money(o.cups * ev.cost)}</b> из ${money(t.money)}${o.cups >= max && max < C.MAX_CUPS ? '. На большее не хватит' : '. Непроданное выльют'}</p></div>
      </div>
      <div class="cf-sec"><div class="cf-t"><i>3</i>Карта <span>· по желанию</span></div>
        <div class="cf-cards">${col(true, 'Помощь себе')}${col(false, 'Пакость сопернику')}</div>
        <p class="cf-note ${peeked ? 'peek' : ''}">${note}</p></div>
      <p class="cf-sum">Ваше решение: <b>${o.price} ₽</b> за чашку · <b>${o.cups}</b> ${plural(o.cups, 'чашка', 'чашки', 'чашек')} · ${played ? `${C.CARDS[played].e} <b>${C.CARDS[played].n}</b>` : 'без карты'}</p>
    </div>`;
  }
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !host.contains(b)) return;
    if (b.dataset.card !== 'insider') arm = false;
    if (b.dataset.p) o.price = +b.dataset.p;
    else if (b.dataset.c) o.cups = Math.max(0, Math.min(maxCups(), o.cups + +b.dataset.c));
    else if (b.dataset.card) {
      const id = b.dataset.card;
      if (id === 'insider') { if (t.peek == null) { if (arm) on.peek?.(); arm = !arm; render(); } return; }
      o.card = o.card === id ? null : id;
    } else return;
    render(); on.change?.({ ...o });
  });
  render();
  return {
    get value() { fix(); return { ...o }; },
    update(nt, nev) { t = nt; if (nev) ev = nev; render(); }
  };
}
