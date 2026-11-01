/* ================= COFFEE BATTLE: shared rules (presenter + phones) ================= */
const COFFEE = {
  START: 1000,
  PRICES: [40, 60, 80, 100],
  MAX_CUPS: 80,
  STEP: 5,
  /* доля желающих, которые купят кофе по такой цене */
  W: { 40: 1, 60: .9, 80: .8, 100: .6 },
  /* сколько людей придёт на самом деле: в новости n, а придёт от n−20% до n+20% */
  SPREAD: .2,
  /* какая доля желающих идёт в кофейню, где дешевле; реклама и слух сдвигают её */
  SHARE: .7, AD: .15, RUMOR: .2,
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
    normal:   { e:'☕', t:'Обычный понедельник', n:60, cost:20,
                x:'Пары как всегда. Около 60 человек захотят кофе.' },
    frost:    { e:'🥶', t:'Мороз −25°', n:90, cost:20,
                x:'Все хотят согреться. Покупателей намного больше обычного.' },
    session:  { e:'📚', t:'Сессия', n:110, cost:20, w:{ 40:1, 60:1, 80:.9, 100:.8 },
                x:'Студенты не спят ночами. Кофе нужен всем, и даже дорогой их не пугает.' },
    holidays: { e:'🏖️', t:'Каникулы', n:25, cost:20,
                x:'Колледж почти пустой. Кофе захотят совсем немногие.' },
    beans:    { e:'📈', t:'Зёрна подорожали', n:60, cost:35,
                x:'Кофе везут из Бразилии и платят за него долларами. Доллар вырос — чашка теперь обходится в 35 ₽.' },
    rain:     { e:'🌧️', t:'Ливень', n:40, cost:20,
                x:'Никто не хочет выходить из здания. Покупателей меньше обычного.' },
    stipend:  { e:'💸', t:'Пришла стипендия', n:75, cost:20, w:{ 40:1, 60:1, 80:.9, 100:.7 },
                x:'У студентов появились деньги. Покупателей больше, и дорогой кофе их не так пугает.' },
    blogger:  { e:'📱', t:'Блогер против кофе', n:40, cost:20,
                x:'Популярный блогер сказал, что кофе вреден. Часть студентов поверила.' },
    cups:     { e:'🥤', t:'Оптовая скидка', n:60, cost:10,
                x:'Поставщик устроил распродажу стаканчиков и зёрен. Чашка обходится всего в 10 ₽.' },
    festival: { e:'🎉', t:'День студента', n:95, cost:20,
                x:'Праздник! В колледже концерт, и кофе хотят почти все.' }
  }
};

/* ---------- chance: the same maths for the forecast in the form and for the real round ----------
   N people want coffee, any number in n ± SPREAD equally likely (exactly n once the insider told it).
   `share` of them come to this shop, and each of those buys with chance w (8 из 10 = 0.8). */
const coffeeCrowd = n => { const s = Math.round(n * COFFEE.SPREAD); return n - s + Math.floor(Math.random() * (2 * s + 1)); };
const coffeeBuyers = (people, w) => { let b = 0; for (let j = 0; j < people; j++) if (Math.random() < w) b++; return b; };
/* -> { lo, hi }: 8 times out of 10 the buyers land in lo..hi;  all: chance to sell every cup;  sold: cups sold on average */
function coffeeOdds(n, exact, share, w, cups) {
  const s = exact ? 0 : Math.round(n * COFFEE.SPREAD), k = 2 * s + 1, pmf = [];
  for (let N = n - s; N <= n + s; N++) {
    const people = Math.round(N * share);
    if (w >= 1) { pmf[people] = (pmf[people] || 0) + 1 / k; continue; }
    let p = Math.pow(1 - w, people);  // binomial: nobody buys, then step to b+1 buyers
    for (let b = 0; b <= people; b++) { pmf[b] = (pmf[b] || 0) + p / k; p *= (people - b) / (b + 1) * w / (1 - w); }
  }
  let acc = 0, lo = null, hi = null, all = 0, sold = 0;
  for (let b = 0; b < pmf.length; b++) {
    const p = pmf[b] || 0;
    acc += p;
    if (lo == null && acc > .1) lo = b;
    if (hi == null && acc >= .9) hi = b;
    if (b >= cups) all += p;
    sold += Math.min(b, cups) * p;
  }
  return { lo, hi: hi ?? pmf.length - 1, all, sold };
}

/* ---------- order form: the same on the captain's phone and in the presenter's manual-entry window ---------- */
/* t: { money, cards:{id:true|false}, peek }  ev: { n, cost, w }  init: last order  on: { change(order), peek() } */
function coffeeForm(host, t, ev, init, on) {
  const C = COFFEE;
  const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  const o = { price: 60, cups: 30, card: null };
  if (init) ['price', 'cups', 'card'].forEach(k => { if (k in init) o[k] = init[k]; });
  if (o.card && !t.cards[o.card]) o.card = null;
  let arm = false;      // Insider needs a second tap: it spends the card for this round
  let rival = 'same';   // forecast only: what the team expects from the rival's price
  const maxCups = () => Math.max(0, Math.min(C.MAX_CUPS, Math.floor(t.money / ev.cost / C.STEP) * C.STEP));
  const fix = () => { o.cups = Math.max(0, Math.min(o.cups, maxCups())); };
  const pct = p => p > .99 && p < 1 ? '>99%' : p < .01 && p > 0 ? '<1%' : Math.round(p * 100) + '%';
  /* people × share × buy rate = buyers, then the chance to sell every cup brewed */
  function forecast(w, peeked) {
    const top = C.PRICES[C.PRICES.length - 1];
    const guess = (rival === 'low' && o.price === C.PRICES[0]) || (rival === 'high' && o.price === top) ? 'same' : rival;
    let share = { low: 1 - C.SHARE, same: .5, high: C.SHARE }[guess];
    if (o.card === 'ad') share += C.AD;
    if (o.card === 'rumor') share += C.RUMOR;
    share = Math.min(.9, Math.max(.1, share));
    const n = peeked ? t.peek : ev.n, f = coffeeOdds(n, peeked, share, w, o.cups), mean = Math.round(n * share * w);
    const term = (v, s, cls) => `<span class="cf-x ${cls || ''}"><b>${v}</b><small>${s}</small></span>`;
    const opt = (k, s) => `<button type="button" class="${guess === k ? 'on' : ''}" data-g="${k}" ${(k === 'low' && o.price === C.PRICES[0]) || (k === 'high' && o.price === top) ? 'disabled' : ''}>${s}</button>`;
    const odds = f.all >= .7 ? 'good' : f.all >= .4 ? 'acc' : 'evil';
    const advice = o.cups > f.hi ? 'Скорее всего, часть кофе придётся вылить'
      : o.cups < f.lo ? 'Скорее всего, кофе не хватит и часть покупателей уйдёт к соперникам'
      : 'Примерно столько покупателей и придёт';
    const profit = Math.round(f.sold * o.price - o.cups * ev.cost);
    return `<div class="cf-fc">
      <div class="cf-fc-l">
        <div class="cf-fc-h"><b>Сколько придёт покупателей?</b><span class="cf-guess"><small>Цена у соперника:</small>${opt('low', 'ниже')}${opt('same', 'такая же')}${opt('high', 'выше')}</span></div>
        <div class="cf-eq">${term((peeked ? '' : '≈') + n, peeked ? 'хотят кофе, точно' : 'хотят кофе')}<i>×</i>${term(Math.round(share * 100) + '%', 'придут к вам' + (o.card === 'ad' ? ' с рекламой' : o.card === 'rumor' ? ' после слуха' : ''))}<i>×</i>${term(Math.round(w * 100) + '%', `купят по ${o.price} ₽`)}<i>=</i>${term('≈' + mean, f.lo === f.hi ? plural(mean, 'покупатель', 'покупателя', 'покупателей') : `обычно от ${f.lo} до ${f.hi}`, 'tot')}</div>
      </div>
      <div class="cf-fc-r">${o.cups ? `
        <span>Шанс продать все ${o.cups} ${plural(o.cups, 'чашку', 'чашки', 'чашек')}</span>
        <div class="cf-odds ${odds}"><b>${pct(f.all)}</b><span class="cf-bar"><i style="width:${Math.round(f.all * 100)}%"></i></span></div>
        <span>${advice}</span>
        <span>В среднем заработаете <b>${profit < 0 ? '−' : '+'}${money(Math.abs(profit))}</b></span>` : '<span>Кофе не варите: ничего не потратите и ничего не заработаете.</span>'}
      </div>
    </div>`;
  }
  /* three steps, each is buttons plus one plain line; the forecast reacts to every tap */
  function render() {
    fix();
    const w = (ev.w || C.W), peeked = t.peek != null, max = maxCups(), ids = Object.keys(C.CARDS);
    const card = id => {
      const c = C.CARDS[id];
      const used = !t.cards[id] && !(id === 'insider' && peeked);
      const sel = id === 'insider' ? peeked : o.card === id;
      const dis = used || (peeked && id !== 'insider') || (id === 'insider' && !peeked && !!o.card);
      const armed = id === 'insider' && arm && !peeked && !dis;
      const d = used ? 'Уже сыграна' : armed ? 'Нажмите ещё раз — узнаете число' : id === 'insider' && peeked ? `Кофе захотят ровно ${t.peek} ${plural(t.peek, 'человек', 'человека', 'человек')}` : c.d;
      return `<button type="button" class="cf-c ${c.good ? 'good' : 'evil'} ${sel || armed ? 'on' : ''} ${used ? 'used' : ''}" data-card="${id}" ${dis ? 'disabled' : ''}><span>${c.e}</span><b>${c.n}</b><small>${d}</small></button>`;
    };
    const col = (good, title) => `<div class="cf-col ${good ? 'good' : 'evil'}"><span class="cf-g">${title}</span>${ids.filter(id => C.CARDS[id].good === good).map(card).join('')}</div>`;
    host.innerHTML = `<div class="cf">
      <p class="cf-goal">Выберите <b>цену</b> и <b>сколько чашек сварить</b>. Игра посчитает, сколько придёт покупателей и какой шанс продать всё.</p>
      <div class="cf-pair">
        <div class="cf-sec"><div class="cf-t"><i>1</i>Цена чашки</div>
          <div class="cf-prices">${C.PRICES.map(p => `<button type="button" class="cf-p ${p === o.price ? 'on' : ''}" data-p="${p}">${p} ₽</button>`).join('')}</div>
          <p class="cf-note">По ${o.price} ₽ кофе купят ${Math.round(w[o.price] * 10)} из 10 желающих</p></div>
        <div class="cf-sec"><div class="cf-t"><i>2</i>Сколько чашек сварить</div>
          <div class="cf-cups"><button type="button" data-c="-${C.STEP}" ${o.cups <= 0 ? 'disabled' : ''} aria-label="Меньше">−</button><b>${o.cups}</b><button type="button" data-c="${C.STEP}" ${o.cups >= max ? 'disabled' : ''} aria-label="Больше">+</button></div>
          <p class="cf-note">Потратите <b>${money(o.cups * ev.cost)}</b> из ${money(t.money)}${o.cups >= max && max < C.MAX_CUPS ? '. На большее не хватит' : '. Непроданное выльют'}</p></div>
      </div>
      ${forecast(w[o.price], peeked)}
      <div class="cf-sec"><div class="cf-t"><i>3</i><span>Карта <em>· по желанию, каждая — один раз за игру</em></span></div>
        <div class="cf-cards">${col(true, 'Помощь себе')}${col(false, 'Пакость сопернику')}</div></div>
    </div>`;
  }
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !host.contains(b)) return;
    if (b.dataset.g) { rival = b.dataset.g; render(); return; }
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
