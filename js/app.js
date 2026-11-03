import { CONFIG, LABELS } from './config.js';
import { getChapters, getSurah, getBismillah, getTafsir, sanitizeHtml, resetSources } from './api.js';

const $ = (sel, el = document) => el.querySelector(sel);
const main = $('#main');

/* ---------------- Settings (saved in the browser) ---------------- */

const DEFAULTS = { arSize: 34, trSize: 17, showFr: true, showEn: false, tafsirLang: 'en', theme: 'auto' };
const settings = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('quran.settings') || '{}') }; }
  catch { return { ...DEFAULTS }; }
})();
function saveSettings() {
  try { localStorage.setItem('quran.settings', JSON.stringify(settings)); } catch { /* private mode */ }
  applySettings();
}
function applySettings() {
  const r = document.documentElement;
  r.style.setProperty('--ar-size', `${settings.arSize}px`);
  r.style.setProperty('--tr-size', `${settings.trSize}px`);
  r.classList.toggle('hide-fr', !settings.showFr);
  r.classList.toggle('hide-en', !settings.showEn);
  if (settings.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = settings.theme;
}

/* ---------------- Helpers ---------------- */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => c != null && e.append(c));
  return e;
};
const norm = (s) => (s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ًͯ-ٰٟۖ-ۭ]/g, '') // Latin accents + Arabic diacritics
  .replace(/[ٱأإآ]/g, 'ا').replace(/[^a-z0-9ء-ي ]/g, '');
const revLabel = (r) => (r === 'madinah' ? 'Médinoise' : 'Mecquoise');
const sourceName = (src) => (src === 'primary' ? `${CONFIG.primary.name} (quran.com)` : CONFIG.fallback.name);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function loading(text = 'Chargement…') {
  return el('div', { class: 'state', role: 'status' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { text }));
}
function errorBox(err, retry) {
  return el('div', { class: 'state error', role: 'alert' },
    el('p', { class: 'error-title', text: 'Impossible de charger le contenu' }),
    el('p', { text: err?.message || String(err) }),
    el('button', { class: 'btn', type: 'button', onclick: () => { resetSources(); retry(); }, text: 'Réessayer' }));
}

function ayahUrl(key) {
  return `${location.origin}${location.pathname}#${key}`;
}
async function share(key, title) {
  const url = ayahUrl(key);
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Lien copié'); }
  catch { prompt('Copiez ce lien :', url); }
}

/* ---------------- Router ---------------- */
// #            -> list of surahs
// #2           -> surah 2
// #2:255       -> surah 2, scrolled to ayah 255

function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')).trim();
  const m = h.match(/^(\d{1,3})(?::(\d{1,3}))?$/);
  if (!m) return { view: 'home' };
  const s = +m[1];
  if (s < 1 || s > 114) return { view: 'home' };
  return { view: 'surah', surah: s, ayah: m[2] ? +m[2] : null };
}

let current = { view: null, surah: null };
async function route() {
  const r = parseHash();
  if ($('#tafsir').open) $('#tafsir').close();
  if (r.view === 'surah') {
    if (current.view === 'surah' && current.surah === r.surah && main.querySelector('.ayah')) {
      if (r.ayah) scrollToAyah(r.surah, r.ayah); else window.scrollTo(0, 0);
      return;
    }
    current = r;
    await renderSurah(r.surah, r.ayah);
  } else {
    current = r;
    await renderHome();
  }
}

/* ---------------- Home ---------------- */

let homeQuery = '';
async function renderHome() {
  document.title = 'Le Noble Coran — lecture, traduction et tafsir Ibn Kathir';
  main.replaceChildren(loading('Chargement des sourates…'));
  let res;
  try { res = await getChapters(); } catch (e) { main.replaceChildren(errorBox(e, renderHome)); return; }
  if (current.view !== 'home') return;
  const chapters = res.data;

  const list = el('ol', { class: 'surah-list', 'aria-label': 'Les 114 sourates' });
  const empty = el('p', { class: 'muted center', hidden: true, text: 'Aucune sourate ne correspond.' });
  const items = chapters.map((c) => {
    const li = el('li', {},
      el('a', { class: 'surah-item', href: `#${c.id}` },
        el('span', { class: 'num', text: c.id }),
        el('span', { class: 'names' },
          el('span', { class: 'translit', text: c.nameSimple }),
          el('span', { class: 'meaning', text: c.meaning })),
        el('span', { class: 'meta' },
          el('span', { class: 'ar-name', lang: 'ar', dir: 'rtl', text: c.nameArabic }),
          el('span', { class: 'small', text: `${c.versesCount} versets · ${revLabel(c.revelation)}` }))));
    li.dataset.search = norm(`${c.id} ${c.nameSimple} ${c.meaning} ${c.nameArabic}`);
    list.append(li);
    return li;
  });

  const filter = (q) => {
    homeQuery = q;
    const nq = norm(q).trim();
    let shown = 0;
    items.forEach((li) => {
      const ok = !nq || li.dataset.search.split(' ').some((w) => w.startsWith(nq)) || li.dataset.search.includes(nq);
      li.hidden = !ok; if (ok) shown++;
    });
    empty.hidden = shown > 0;
  };

  const input = el('input', {
    type: 'search', id: 'q', placeholder: 'Rechercher : nom, sens, numéro, ou 2:255', autocomplete: 'off',
    'aria-label': 'Rechercher une sourate', value: homeQuery, oninput: (e) => filter(e.target.value),
  });
  const form = el('form', { class: 'search', role: 'search', onsubmit: (e) => {
    e.preventDefault();
    const v = input.value.trim().replace(/\s/g, '');
    if (/^\d{1,3}(:\d{1,3})?$/.test(v)) { location.hash = v; return; }
    const first = items.find((li) => !li.hidden);
    if (first) location.hash = first.querySelector('a').getAttribute('href');
  } }, input);

  main.replaceChildren(
    el('section', { class: 'intro' },
      el('h1', { text: 'Le Noble Coran' }),
      el('p', { class: 'muted', text: 'Choisissez une sourate. Touchez un verset pour lire le tafsir d’Ibn Kathir correspondant.' }),
      form),
    list, empty,
    el('p', { class: 'source-line', text: `Liste des sourates : ${sourceName(res.source)}` }));
  filter(homeQuery);
}

/* ---------------- Surah ---------------- */

let surahCtx = null; // { chapter, verses, source }

async function renderSurah(n, targetAyah) {
  main.replaceChildren(loading('Chargement de la sourate…'));
  let chapters, surah, bism = null;
  try {
    chapters = (await getChapters()).data;
    const chapter = chapters[n - 1];
    [surah, bism] = await Promise.all([
      getSurah(n, chapter.versesCount),
      chapter.bismillahPre ? getBismillah().then((r) => r.data).catch(() => null) : Promise.resolve(null),
    ]);
  } catch (e) {
    main.replaceChildren(errorBox(e, () => renderSurah(n, targetAyah)));
    return;
  }
  if (current.view !== 'surah' || current.surah !== n) return;
  const chapter = chapters[n - 1];
  surahCtx = { chapter, verses: surah.data, source: surah.source };
  document.title = `${chapter.id}. ${chapter.nameSimple} — ${chapter.meaning} | Le Noble Coran`;

  const prev = chapters[n - 2], next = chapters[n];
  const nav = () => el('nav', { class: 'surah-nav', 'aria-label': 'Sourates voisines' },
    prev ? el('a', { class: 'btn ghost', href: `#${prev.id}`, rel: 'prev' }, `‹ ${prev.id}. ${prev.nameSimple}`) : el('span'),
    next ? el('a', { class: 'btn ghost', href: `#${next.id}`, rel: 'next' }, `${next.id}. ${next.nameSimple} ›`) : el('span'));

  const jumpInput = el('input', { type: 'number', min: 1, max: chapter.versesCount, inputmode: 'numeric', placeholder: 'n°', 'aria-label': 'Numéro du verset' });
  const jump = el('form', { class: 'jump', onsubmit: (e) => {
    e.preventDefault();
    const a = +jumpInput.value;
    if (a >= 1 && a <= chapter.versesCount) location.hash = `${n}:${a}`;
    else toast(`Entrez un numéro entre 1 et ${chapter.versesCount}`);
  } }, el('label', { text: 'Aller au verset' }), jumpInput, el('button', { class: 'btn', type: 'submit', text: 'OK' }));

  const header = el('header', { class: 'surah-head' },
    el('p', { class: 'kicker', text: `Sourate ${chapter.id} · ${chapter.versesCount} versets · ${revLabel(chapter.revelation)}` }),
    el('h1', {}, el('span', { class: 'ar-title', lang: 'ar', dir: 'rtl', text: chapter.nameArabic }),
      el('span', { class: 'lat-title', text: `${chapter.nameSimple} — ${chapter.meaning}` })),
    jump);

  const list = el('div', { class: 'ayahs' });
  const frag = document.createDocumentFragment();
  if (bism) frag.append(el('p', { class: 'bismillah', lang: 'ar', dir: 'rtl', text: bism }));
  surah.data.forEach((v) => frag.append(ayahCard(v, chapter)));
  list.append(frag);

  main.replaceChildren(nav(), header, list, nav(),
    el('p', { class: 'source-line' },
      `Texte arabe et traductions : ${sourceName(surah.source)}`,
      surah.source === 'fallback' ? ` — arabe : ${CONFIG.fallback.editions.ar} (Complexe du Roi Fahd) ; traductions : Tanzil.net` : ' — arabe : text_uthmani ; traductions : Hamidullah (31), Saheeh International (20)'));

  if (targetAyah) scrollToAyah(n, targetAyah);
  else window.scrollTo(0, 0);
}

function ayahCard(v, chapter) {
  const open = () => openTafsir(v.key);
  const card = el('article', { class: 'ayah', tabindex: '-1', id: `a-${v.key.replace(':', '-')}`, 'data-key': v.key,
    onclick: (e) => {
      if (e.target.closest('button, a')) return;
      if (String(window.getSelection?.() || '').length) return; // user is selecting text
      open();
    } },
  el('div', { class: 'ayah-top' },
    el('a', { class: 'ayah-key', href: `#${v.key}`, 'aria-label': `Verset ${v.key}`, text: v.key }),
    el('div', { class: 'ayah-actions' },
      el('button', { class: 'chip', type: 'button', onclick: open, 'aria-label': `Tafsir du verset ${v.key}`, text: 'Tafsir' }),
      el('button', { class: 'chip', type: 'button', onclick: () => share(v.key, `${chapter.nameSimple} ${v.key}`), 'aria-label': `Partager le verset ${v.key}`, text: 'Partager' }))),
  el('p', { class: 'arabic', lang: 'ar', dir: 'rtl' }, v.arabic, ' ', el('span', { class: 'end', 'aria-hidden': 'true', text: arNum(v.number) })),
  v.fr ? el('p', { class: 'tr tr-fr', lang: 'fr', text: v.fr }) : null,
  v.en ? el('p', { class: 'tr tr-en', lang: 'en', text: v.en }) : null);
  return card;
}

function scrollToAyah(s, a) {
  const target = document.getElementById(`a-${s}-${a}`);
  if (!target) { toast(`Le verset ${s}:${a} n'existe pas`); return; }
  document.querySelectorAll('.ayah.target').forEach((x) => x.classList.remove('target'));
  target.classList.add('target');
  requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

/* ---------------- Tafsir panel ---------------- */

const dlg = $('#tafsir');
let tafsirState = { key: null, lang: settings.tafsirLang, req: 0 };

function openTafsir(key, lang = tafsirState.lang || settings.tafsirLang) {
  tafsirState.key = key;
  tafsirState.lang = lang;
  const [s] = key.split(':').map(Number);
  const name = surahCtx?.chapter?.nameSimple || `Sourate ${s}`;
  $('#tafsir-title').textContent = `${name} · verset ${key}`;
  history.replaceState(null, '', `#${key}`);
  dlg.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lang === lang)));
  if (!dlg.open) dlg.showModal();
  loadTafsir();
}

async function loadTafsir() {
  const { key, lang } = tafsirState;
  const req = ++tafsirState.req;
  const body = $('#tafsir-body');
  body.replaceChildren(loading('Chargement du tafsir…'));
  body.scrollTop = 0;
  const [s, a] = key.split(':').map(Number);
  let res;
  try { res = await getTafsir(lang, s, a, surahCtx?.chapter?.versesCount || 286); }
  catch (e) { if (req === tafsirState.req) body.replaceChildren(errorBox(e, loadTafsir)); return; }
  if (req !== tafsirState.req) return;

  const t = res.data;
  const out = [];
  const keys = t.verseKeys;
  if (keys.length > 1) {
    out.push(el('p', { class: 'range-note', role: 'note' },
      el('strong', { text: 'Passage commun : ' }),
      `ce commentaire d’Ibn Kathir porte sur les versets ${keys[0]} à ${keys[keys.length - 1]} ensemble (${keys.length} versets). Il s’affiche donc à l’identique pour chacun d’eux.`));
  }
  const content = el('div', { class: `tafsir-text ${lang === 'ar' ? 'is-ar' : ''}`, lang, dir: lang === 'ar' ? 'rtl' : 'ltr' });
  if (!t.body || !t.body.trim()) {
    content.append(el('p', { class: 'muted', text: 'Cette source ne fournit pas de texte de tafsir pour ce verset.' }));
  } else if (t.kind === 'html') {
    content.append(...sanitizeHtml(t.body).childNodes);
  } else {
    t.body.split(/\n{2,}/).forEach((para) => content.append(el('p', { text: para })));
  }
  out.push(content);
  out.push(el('p', { class: 'source-line' },
    `${LABELS.tafsir[lang]} — ${sourceName(res.source)}`,
    res.source === 'primary' ? ` (tafsir id ${CONFIG.primary.tafsirs[lang]})` : ` (${CONFIG.fallback.tafsirs[lang]})`));
  body.replaceChildren(...out);
}

dlg.querySelectorAll('[role=tab]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.lang !== tafsirState.lang) openTafsir(tafsirState.key, b.dataset.lang);
}));
dlg.addEventListener('close', () => {
  const k = tafsirState.key;
  if (k) document.getElementById(`a-${k.replace(':', '-')}`)?.focus?.();
});

/* ---------------- Dialog basics ---------------- */

document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // tap on backdrop
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
});

/* ---------------- Settings dialog ---------------- */

function initSettings() {
  const ar = $('#ar-size'), tr = $('#tr-size');
  const sync = () => {
    ar.value = settings.arSize; $('#ar-size-out').textContent = `${settings.arSize}px`;
    tr.value = settings.trSize; $('#tr-size-out').textContent = `${settings.trSize}px`;
    $('#show-fr').checked = settings.showFr;
    $('#show-en').checked = settings.showEn;
    document.querySelectorAll('input[name=tafsir-lang]').forEach((r) => { r.checked = r.value === settings.tafsirLang; });
    document.querySelectorAll('input[name=theme]').forEach((r) => { r.checked = r.value === settings.theme; });
  };
  ar.addEventListener('input', () => { settings.arSize = +ar.value; sync(); saveSettings(); });
  tr.addEventListener('input', () => { settings.trSize = +tr.value; sync(); saveSettings(); });
  $('#show-fr').addEventListener('change', (e) => { settings.showFr = e.target.checked; saveSettings(); });
  $('#show-en').addEventListener('change', (e) => { settings.showEn = e.target.checked; saveSettings(); });
  document.querySelectorAll('input[name=tafsir-lang]').forEach((r) => r.addEventListener('change', () => {
    settings.tafsirLang = r.value; tafsirState.lang = r.value; saveSettings();
  }));
  document.querySelectorAll('input[name=theme]').forEach((r) => r.addEventListener('change', () => { settings.theme = r.value; saveSettings(); }));
  $('#open-settings').addEventListener('click', () => { sync(); $('#settings').showModal(); });
  sync();
}

/* ---------------- Start ---------------- */

applySettings();
initSettings();
window.addEventListener('hashchange', route);
route();
