/* ================= CORE ================= */
document.documentElement.lang = 'ru';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r10 = n => Math.round(n / 10) * 10;
const fmt = n => (n < 0 ? '−' : '') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const plural = (n, one, few, many) => { n = Math.abs(n) % 100; const d = n % 10; if (n > 10 && n < 20) return many; if (d > 1 && d < 5) return few; if (d === 1) return one; return many; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const store = {
  get(k, d = null) { try { const v = localStorage.getItem('dengi:' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dengi:' + k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem('dengi:' + k); } catch (e) {} },
  getJSON(k) { try { return JSON.parse(this.get(k)); } catch (e) { return null; } },
  setJSON(k, v) { this.set(k, JSON.stringify(v)); }
};

/* ---------- sound (synthesized, no files) ---------- */
const SFX = (() => {
  let ctx = null, on = store.get('sound', '1') !== '0';
  function ac() {
    if (!on) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, d, { type = 'sine', vol = .12, at = 0, to = null } = {}) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .03);
  }
  function noise(d, { vol = .08, at = 0, freq = 1200 } = {}) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + at, len = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  return {
    get on() { return on; },
    toggle() { on = !on; store.set('sound', on ? '1' : '0'); if (on) this.click(); return on; },
    click() { tone(700, .05, { type:'triangle', vol:.05 }); },
    tick() { tone(980, .035, { type:'square', vol:.025 }); },
    coin() { tone(988, .07, { type:'square', vol:.05 }); tone(1480, .26, { type:'square', vol:.05, at:.07 }); },
    cash() { [0, .06, .12].forEach((a, i) => tone(1100 + i * 220, .12, { type:'triangle', vol:.07, at:a })); noise(.2, { vol:.05, at:.16, freq:4000 }); },
    right() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .2, { type:'triangle', vol:.09, at:i * .08 })); },
    wrong() { tone(220, .38, { type:'sawtooth', vol:.07, to:110 }); tone(233, .38, { type:'sawtooth', vol:.04, to:116 }); },
    evil() { tone(420, .55, { type:'sawtooth', vol:.06, to:90 }); tone(300, .6, { type:'square', vol:.035, at:.1, to:70 }); noise(.3, { vol:.04, freq:500 }); },
    shield() { tone(300, .12, { type:'triangle', vol:.08 }); tone(900, .35, { type:'sine', vol:.09, at:.05, to:1500 }); },
    fanfare() { const n = [523, 659, 784, 1046, 784, 1046]; n.forEach((f, i) => tone(f, .24, { type:'square', vol:.05, at:i * .13 })); tone(1318, .9, { type:'triangle', vol:.08, at:n.length * .13 }); },
    news() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, .18, { type:'triangle', vol:.07, at:i * .1 })); },
    trade() { tone(660, .08, { type:'triangle', vol:.07 }); tone(990, .16, { type:'triangle', vol:.07, at:.08 }); },
    no() { tone(320, .11, { type:'square', vol:.045 }); tone(240, .2, { type:'square', vol:.045, at:.11 }); },
    beep(low) { tone(low ? 520 : 880, .06, { type:'square', vol:.04 }); },
    whoosh() { noise(.35, { vol:.07, freq:900 }); },
    /* coffee battle: the reveal show and the card effects */
    vs() { noise(.4, { vol:.08, freq:700 }); tone(196, .35, { type:'square', vol:.06, at:.25 }); tone(294, .5, { type:'square', vol:.06, at:.42 }); },
    horn() { [392, 523, 659].forEach((f, i) => tone(f, .2, { type:'sawtooth', vol:.045, at:i * .11 })); tone(784, .55, { type:'square', vol:.05, at:.33 }); },
    truck() { noise(1, { vol:.07, freq:160 }); tone(80, 1, { type:'sawtooth', vol:.035, to:130 }); tone(440, .12, { type:'square', vol:.05, at:.55 }); tone(440, .16, { type:'square', vol:.05, at:.72 }); },
    roach() { for (let i = 0; i < 12; i++) noise(.04, { vol:.05, at:i * .06, freq:2800 + (i % 3) * 900 }); },
    stamp() { tone(120, .3, { type:'square', vol:.12, to:45 }); noise(.18, { vol:.14, freq:260 }); },
    zap() { tone(1500, .55, { type:'sawtooth', vol:.06, to:55 }); noise(.3, { vol:.07, freq:2600 }); tone(60, .4, { type:'square', vol:.05, at:.45 }); },
    drum(d = 1.4) { const n = Math.round(d / .055); for (let i = 0; i < n; i++) noise(.05, { vol:.035 + i / n * .05, at:i * .055, freq:220 }); noise(.9, { vol:.11, at:d, freq:5200 }); },
    boom() { noise(.6, { vol:.1, freq:160 }); tone(70, .5, { type:'sine', vol:.12, to:40 }); }
  };
})();

/* ---------- confetti of coins and bills ---------- */
const Confetti = (() => {
  const cv = $('#confetti'), cx = cv.getContext('2d');
  let parts = [], raf = 0;
  function size() { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
  const TOON = ['#FFD23F', '#FF5FA2', '#2EC4F1', '#2BD67B', '#B36BFF', '#FF8A00'];
  function burst({ x = innerWidth / 2, y = innerHeight * .4, n = 150, spread = 1, toon = false } = {}) {
    if (reduced) return;
    size();
    const gold = cssVar('--g-gold') || '#F2C14E', gold3 = cssVar('--g-gold-3') || '#9A6B10', green = cssVar('--g-ok') || '#2BD67B', bill = cssVar('--brand') || '#136447';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (4 + Math.random() * 11) * spread;
      const q = Math.random(), kind = toon ? (q < .35 ? 'coin' : q < .65 ? 'star' : q < .85 ? 'dot' : 'bill') : q < .6 ? 'coin' : 'bill';
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 7, r: (toon ? 8 : 6) + Math.random() * 7, rot: Math.random() * 6.3, vr: (Math.random() - .5) * .35,
        kind, toon, c1: gold, c2: toon ? '#16110E' : gold3, c3: toon ? TOON[i % TOON.length] : Math.random() < .5 ? green : bill, life: 0 });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  /* firework: a ring of glowing sparks in the given colours */
  function spark({ x, y, colors, n = 70, toon = false }) {
    if (reduced) return;
    if (!raf) size();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * .2, s = 3 + Math.random() * 6;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: toon ? 6 + Math.random() * 4 : 2 + Math.random() * 2.5, kind: 'spark', toon, rot: a, c1: toon ? TOON[i % TOON.length] : colors[i % colors.length], life: 0 });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function fireworks(colors, { shots = 7, gap = 320, toon = false } = {}) {
    for (let k = 0; k < shots; k++) setTimeout(() => {
      spark({ x: innerWidth * (.15 + Math.random() * .7), y: innerHeight * (.12 + Math.random() * .35), colors, n: toon ? 36 : 70, toon });
      SFX.boom();
    }, k * gap);
  }
  /* a five-point star with an ink outline, centred on the current origin */
  function star(r) {
    cx.beginPath();
    for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2 - Math.PI / 2, q = j % 2 ? r * .45 : r; cx.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    cx.closePath(); cx.fill(); cx.strokeStyle = '#16110E'; cx.lineWidth = 2.5; cx.lineJoin = 'round'; cx.stroke();
  }
  function loop() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      if (p.kind === 'spark') {
        p.vy += .07; p.vx *= .97; p.vy *= .97; p.x += p.vx; p.y += p.vy; p.life++;
        cx.globalAlpha = Math.max(0, 1 - p.life / 90); cx.fillStyle = p.c1;
        if (p.toon) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot + p.life * .05); star(p.r); cx.restore(); }
        else { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
        cx.globalAlpha = 1;
        continue;
      }
      p.vy += .32; p.vx *= .985; p.vy *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      cx.save(); cx.translate(p.x, p.y);
      if (p.kind === 'coin') {
        const w = Math.max(1, Math.abs(Math.cos(p.rot)) * p.r);
        cx.fillStyle = p.c1; cx.beginPath(); cx.ellipse(0, 0, w, p.r, 0, 0, 7); cx.fill();
        cx.strokeStyle = p.c2; cx.lineWidth = p.toon ? 2.5 : 1.5; cx.stroke();
      } else if (p.kind === 'star') {
        cx.rotate(p.rot); cx.fillStyle = p.c3; star(p.r * 1.1);
      } else if (p.kind === 'dot') {
        cx.fillStyle = p.c3; cx.beginPath(); cx.arc(0, 0, p.r * .6, 0, 7); cx.fill();
        cx.strokeStyle = '#16110E'; cx.lineWidth = 2.5; cx.stroke();
      } else {
        cx.rotate(p.rot); cx.scale(1, Math.abs(Math.sin(p.rot * 1.3)) * .8 + .2);
        cx.fillStyle = p.c3; cx.fillRect(-p.r * 1.3, -p.r * .65, p.r * 2.6, p.r * 1.3);
        if (p.toon) { cx.strokeStyle = '#16110E'; cx.lineWidth = 2.5; cx.strokeRect(-p.r * 1.3, -p.r * .65, p.r * 2.6, p.r * 1.3); }
      }
      cx.restore();
    }
    parts = parts.filter(p => p.y < innerHeight + 60 && p.life < (p.kind === 'spark' ? 90 : 420));
    if (parts.length) raf = requestAnimationFrame(loop); else { raf = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  return { burst, spark, fireworks };
})();

/* ---------- guilloche rosettes (banknote ornament) ---------- */
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function guillochePath(R, r, d) {
  const loops = r / gcd(R, r), steps = Math.min(4000, loops * 50), k = (R - r) / r, T = Math.PI * 2 * loops;
  let s = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps * T;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t), y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    s += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return s;
}
function drawRosette(svg, layers) {
  svg.innerHTML = layers.map(l => `<path d="${guillochePath(l.R, l.r, l.d)}" style="fill:none;stroke:${l.c};stroke-width:${l.w || .5};opacity:${l.o || 1}"/>`).join('');
}
$$('svg[data-g="rosette"]').forEach(svg => drawRosette(svg, [
  { R:120, r:43, d:76, c:'var(--note-ink)', w:.45, o:.55 },
  { R:96,  r:35, d:58, c:'var(--gold)', w:.5, o:.85 },
  { R:72,  r:25, d:44, c:'var(--note-ink)', w:.4, o:.45 }
]));
drawRosette($('#deckOrn'), [
  { R:120, r:47, d:80, c:'var(--line-2)', w:.4 },
  { R:90,  r:31, d:60, c:'var(--line)', w:.4 }
]);

/* ---------- ambient coin rain (title & final slides) ---------- */
const CoinRain = (() => {
  const cv = $('#coinsCanvas'), cx = cv.getContext('2d');
  let coins = [], raf = 0, running = false, W = 0, H = 0;
  function size() { const d = Math.min(2, devicePixelRatio || 1), b = cv.getBoundingClientRect(); W = b.width; H = b.height; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); }
  function make(initial) { const r = 9 + Math.random() * 16; return { x: Math.random() * W, y: initial ? Math.random() * H : -40, r, v: .35 + Math.random() * .8 + r / 40, rot: Math.random() * 6.3, vr: .01 + Math.random() * .03, sway: Math.random() * 6.3 }; }
  function frame() {
    if (!running) { raf = 0; return; }
    const g1 = cssVar('--gold-2'), g2 = cssVar('--gold'), ink = cssVar('--gold-ink');
    cx.clearRect(0, 0, W, H);
    for (const c of coins) {
      c.y += c.v; c.rot += c.vr; c.sway += .01; c.x += Math.sin(c.sway) * .25;
      if (c.y > H + 40) Object.assign(c, make(false));
      const w = Math.max(1, Math.abs(Math.cos(c.rot)) * c.r);
      cx.globalAlpha = .55;
      cx.fillStyle = g1; cx.beginPath(); cx.ellipse(c.x, c.y, w, c.r, 0, 0, 7); cx.fill();
      cx.strokeStyle = g2; cx.lineWidth = 2; cx.stroke();
      if (w > c.r * .55) { cx.fillStyle = ink; cx.globalAlpha = .35; cx.font = `800 ${c.r}px Unbounded, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('₽', c.x, c.y + 1); }
    }
    cx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  function start() { if (reduced || running) return; running = true; cv.classList.add('on'); size(); if (!coins.length) coins = Array.from({ length: Math.round(clamp(W / 46, 12, 34)) }, () => make(true)); if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { running = false; cv.classList.remove('on'); }
  addEventListener('resize', () => { if (running) size(); });
  return { start, stop };
})();

/* ---------- slide deck ---------- */
const Deck = (() => {
  const slides = $$('.slide');
  const hooks = {};
  const listeners = [];
  let cur = -1, step = 0;
  const maxSteps = i => +(slides[i].dataset.steps || 0);
  const idx = id => slides.findIndex(s => s.id === id);

  function chrome() {
    const s = slides[cur];
    $('#progressFill').style.width = ((cur + (maxSteps(cur) ? step / (maxSteps(cur) + 1) : 0)) / (slides.length - 1) * 100) + '%';
    $('#counter').textContent = `${cur + 1} / ${slides.length}`;
    $('#btnPrev').disabled = cur === 0 && step === 0;
    $('#btnNext').disabled = cur === slides.length - 1;
    const m = maxSteps(cur);
    $('#stepDots').innerHTML = m ? Array.from({ length: m + 1 }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('') : '';
    const sec = s.dataset.sec;
    $$('#secnav button').forEach(b => { const t = slides[idx(b.dataset.go)]; b.classList.toggle('on', !!t && t.dataset.sec === sec); });
    const notes = s.querySelector('aside.notes');
    $('#notesPanel').innerHTML = `<h4>Подсказка ведущему · слайд ${cur + 1}</h4>` + (notes ? notes.innerHTML : '<p>Без подсказок.</p>');
    (s.id === 'start' || s.id === 'final') ? CoinRain.start() : CoinRain.stop();
  }
  function apply() {
    const s = slides[cur];
    s.querySelectorAll('[data-show]').forEach(e => e.classList.toggle('shown', +e.dataset.show <= step));
    hooks[s.id]?.step?.(step);
    chrome();
    listeners.forEach(f => f(s.id, step));
  }
  function go(i, st = 0) {
    i = clamp(i, 0, slides.length - 1);
    const changed = i !== cur;
    if (changed && cur >= 0) hooks[slides[cur].id]?.leave?.();
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.classList.toggle('is-past', k < i);
      s.inert = k !== i;
      s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
    });
    cur = i; step = clamp(st, 0, maxSteps(i));
    $('#deck').scrollTop = 0;
    if (changed) { slides[i].scrollTop = 0; hooks[slides[i].id]?.enter?.(); }
    apply();
    try { history.replaceState(null, '', '#' + slides[i].id); } catch (e) {}
    store.set('slide', slides[i].id);
  }
  function next() { if (step < maxSteps(cur)) { step++; apply(); SFX.tick(); } else if (cur < slides.length - 1) { go(cur + 1); SFX.whoosh(); } }
  function prev() { if (step > 0) { step--; apply(); } else if (cur > 0) go(cur - 1, maxSteps(cur - 1)); }
  return {
    hooks, next, prev,
    goTo(id, st = 0) { const i = idx(id); if (i >= 0) go(i, st); },
    setStep(n) { step = clamp(n, 0, maxSteps(cur)); apply(); },
    onChange(f) { listeners.push(f); },
    init() {
      let start = location.hash.slice(1) || store.get('slide') || 'start';
      if (idx(start) < 0) start = 'start';
      go(idx(start));
    },
    get current() { return slides[cur]?.id; },
    get step() { return step; },
    get el() { return slides[cur]; }
  };
})();

/* ---------- chrome controls ---------- */
const UI = {
  toggleNotes() { const p = $('#notesPanel'); p.hidden = !p.hidden; $('#btnNotes').classList.toggle('on', !p.hidden); },
  toggleSound() { const on = SFX.toggle(); $('#btnSound').textContent = on ? '🔊' : '🔇'; const g = $('#gSound'); if (g) g.textContent = on ? '🔊' : '🔇'; },
  toggleTheme() {
    const root = document.documentElement;
    const isDark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = isDark ? 'light' : 'dark';
    store.set('theme', root.dataset.theme);
  },
  async toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) { /* fullscreen is optional */ }
  }
};
(() => {
  const t = store.get('theme'); if (t) document.documentElement.dataset.theme = t;
  $('#btnSound').textContent = SFX.on ? '🔊' : '🔇';
})();
$('#btnNotes').addEventListener('click', UI.toggleNotes);
$('#btnSound').addEventListener('click', UI.toggleSound);
$('#btnTheme').addEventListener('click', UI.toggleTheme);
$('#btnFull').addEventListener('click', UI.toggleFull);
$('#btnPrev').addEventListener('click', () => Deck.prev());
$('#btnNext').addEventListener('click', () => Deck.next());

document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go && !go.closest('.game')) { Deck.goTo(go.dataset.go); SFX.click(); return; }
  const act = e.target.closest('[data-action]');
  if (!act) return;
  if (act.dataset.action === 'next') Deck.next();
  if (act.dataset.action === 'open-game') Game.open();
});

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (Game.isOpen()) { Game.key(e); return; }
  if (Deck.hooks[Deck.current]?.key?.(e)) { e.preventDefault(); return; }
  const onButton = e.target.closest && e.target.closest('button');
  switch (e.code) {
    case 'ArrowRight': case 'PageDown': e.preventDefault(); Deck.next(); break;
    case 'ArrowLeft': case 'PageUp': e.preventDefault(); Deck.prev(); break;
    case 'Space': case 'Enter': if (!onButton) { e.preventDefault(); Deck.next(); } break;
    case 'Home': Deck.goTo('start'); break;
    case 'End': Deck.goTo('hw'); break;
    case 'KeyF': UI.toggleFull(); break;
    case 'KeyN': UI.toggleNotes(); break;
    case 'KeyM': UI.toggleSound(); break;
  }
});
