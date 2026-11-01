/* ================= COFFEE BATTLE: shared rules (presenter + phones) ================= */
const COFFEE = {
  START: 1000,
  PRICES: [40, 60, 80, 100],
  MAX_CUPS: 80,
  STEP: 10,
  /* доля желающих, которые купят кофе по такой цене */
  W: { 40: 1, 60: .9, 80: .75, 100: .6 },
  LOAN: { now: 600, back: 800 },
  DEPOSIT: { now: 500, back: 650 },
  POWER_CAP: 20,
  TAX: .3,
  EMOJI: ['☕', '🧋', '🍩', '🥐', '🧁', '🍪', '🥤', '🍫'],
  CARDS: {
    ad:      { e:'📣', n:'Реклама',            good:true,  d:'К вам придёт больше покупателей.' },
    insider: { e:'🕵️', n:'Инсайдер',           good:true,  d:'Капитан сразу узнаёт точное число покупателей.' },
    shield:  { e:'🛡️', n:'Охрана',             good:true,  d:'Пакости соперника в этом раунде не сработают.' },
    rumor:   { e:'🪳', n:'Слух про таракана',  good:false, d:'Часть покупателей соперника уйдёт к вам.' },
    tax:     { e:'🧾', n:'Налоговая проверка', good:false, d:'Соперник отдаст 30% своей выручки.' },
    power:   { e:'🔌', n:'Отключили свет',     good:false, d:'Соперник сварит не больше 20 чашек.' }
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
    beans:    { e:'🇧🇷', t:'Зёрна подорожали', n:60, cost:35, lvl:'как обычно',
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
/* t: { money, cards:{id:true|false}, loan, dep (already taken?), peek }  ev: { cost, w }  init: last order  on: { change(order), peek() } */
function coffeeForm(host, t, ev, init, on) {
  const C = COFFEE, w = ev.w || C.W;
  const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  const o = { price: 60, cups: 30, card: null, loan: false, dep: false, ...(init || {}) };
  if (t.loan) o.loan = false;
  if (t.dep) o.dep = false;
  if (o.card && !t.cards[o.card]) o.card = null;
  let arm = false;  // Insider needs a second tap: it spends the card for this round
  const budget = () => t.money + (o.loan ? C.LOAN.now : 0) - (o.dep ? C.DEPOSIT.now : 0);
  const maxCups = () => Math.max(0, Math.min(C.MAX_CUPS, Math.floor(budget() / ev.cost / C.STEP) * C.STEP));
  function fix() {
    if (budget() < 0) o.dep = false;
    o.cups = Math.max(0, Math.min(o.cups, maxCups()));
  }
  function render() {
    fix();
    const peeked = t.peek != null;
    host.innerHTML = `<div class="cf">
      <div class="cf-sec"><div class="cf-t"><i>1</i>Цена одной чашки</div>
        <div class="cf-prices">${C.PRICES.map(p => `<button type="button" class="cf-p ${p === o.price ? 'on' : ''}" data-p="${p}"><b>${p} ₽</b><small>купят ${Math.round(w[p] * 10)} из 10</small></button>`).join('')}</div></div>
      <div class="cf-sec"><div class="cf-t"><i>2</i>Сколько чашек сварить</div>
        <div class="cf-cups"><button type="button" data-c="-10" ${o.cups <= 0 ? 'disabled' : ''} aria-label="Меньше">−</button><b>${o.cups}</b><button type="button" data-c="10" ${o.cups >= maxCups() ? 'disabled' : ''} aria-label="Больше">+</button></div>
        <div class="cf-cost">${o.cups} × ${ev.cost} ₽ = <b>${money(o.cups * ev.cost)}</b> · у вас ${money(budget())}${o.cups >= maxCups() && maxCups() < C.MAX_CUPS ? ' — на большее не хватает' : ''}</div></div>
      <div class="cf-sec"><div class="cf-t"><i>3</i>Карта на этот раунд <small>можно без карты</small></div>
        <div class="cf-cards">${Object.entries(C.CARDS).map(([id, c]) => {
          const used = !t.cards[id] && !(id === 'insider' && peeked);
          const sel = id === 'insider' ? peeked : o.card === id;
          const dis = used || (peeked && id !== 'insider') || (id === 'insider' && !peeked && !!o.card);
          const armed = id === 'insider' && arm && !peeked && !dis;
          return `<button type="button" class="cf-c ${c.good ? 'good' : 'evil'} ${sel || armed ? 'on' : ''} ${used ? 'used' : ''}" data-card="${id}" ${dis ? 'disabled' : ''}><span>${c.e}</span><b>${c.n}</b><small>${used ? 'уже использована' : armed ? 'Нажмите ещё раз, чтобы узнать число. Это и будет карта раунда' : c.d}</small></button>`;
        }).join('')}</div>
        ${peeked ? `<div class="cf-peek">🕵️ Инсайдер шепчет: в этом раунде кофе захотят <b>${t.peek}</b> человек на обе кофейни</div>` : ''}</div>
      <div class="cf-sec"><div class="cf-t"><i>4</i>Банк <small>по желанию, один раз за игру</small></div>
        <button type="button" class="cf-b ${o.loan ? 'on' : ''}" data-bank="loan" ${t.loan ? 'disabled' : ''}>💳 <span><b>Кредит</b>${t.loan ? 'уже взят: вернёте 800 ₽ в конце' : '+600 ₽ сейчас, а в конце игры вернуть 800 ₽'}</span></button>
        <button type="button" class="cf-b ${o.dep ? 'on' : ''}" data-bank="dep" ${t.dep || (!o.dep && t.money + (o.loan ? C.LOAN.now : 0) < C.DEPOSIT.now) ? 'disabled' : ''}>🏦 <span><b>Вклад</b>${t.dep ? 'уже открыт: получите 650 ₽ в конце' : 'отдать 500 ₽ сейчас, а в конце получить 650 ₽'}</span></button></div>
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
    } else if (b.dataset.bank) o[b.dataset.bank] = !o[b.dataset.bank];
    else return;
    render(); on.change?.({ ...o });
  });
  render();
  return {
    get value() { fix(); return { ...o }; },
    update(nt, nev) { t = nt; if (nev) ev = nev; render(); }
  };
}
