// Data layer. Text is never written or altered here: it is fetched and passed on as-is.
// The only processing is (a) removing footnote markers (<sup>) from translations, since the
// footnotes themselves are not displayed, and (b) sanitising tafsir HTML (tags whitelist).
import { CONFIG } from './config.js';

const P = CONFIG.primary;
const F = CONFIG.fallback;
let primaryDown = false; // after a network failure, use the mirror for the rest of the visit
const memo = new Map();

export class SourceError extends Error {}

async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new SourceError(`HTTP ${res.status} — ${url}`);
    return await res.json();
  } catch (e) {
    if (e instanceof SourceError) throw e;
    throw new SourceError(`Réseau indisponible — ${url}`);
  } finally {
    clearTimeout(t);
  }
}

function cached(key, fn) {
  if (!memo.has(key)) {
    const p = fn().catch((e) => { memo.delete(key); throw e; });
    memo.set(key, p);
  }
  return memo.get(key);
}

// Try the primary source, then the static mirror. Returns { source, data }.
async function withFallback(primaryFn, fallbackFn) {
  if (!primaryDown) {
    try {
      return { source: 'primary', data: await primaryFn() };
    } catch (e) {
      console.warn('[quran] primary source failed, trying mirror:', e.message);
      primaryDown = true;
    }
  }
  try {
    return { source: 'fallback', data: await fallbackFn() };
  } catch (e) {
    throw new SourceError('Les sources de données sont injoignables. Vérifiez votre connexion puis réessayez.');
  }
}

export function resetSources() { primaryDown = false; }

const stripHtml = (html) => {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
  doc.querySelectorAll('sup').forEach((n) => n.remove()); // footnote markers only
  return doc.body.textContent.replace(/\s+/g, ' ').trim();
};

/* ---------------- Chapters ---------------- */

export function getChapters() {
  return cached('chapters', () => withFallback(
    async () => {
      const d = await getJSON(`${P.base}/chapters?language=fr`);
      if (!Array.isArray(d.chapters) || d.chapters.length !== 114) throw new SourceError('Liste des sourates invalide');
      return d.chapters.map((c) => ({
        id: c.id,
        nameSimple: c.name_simple,
        nameArabic: c.name_arabic,
        meaning: c.translated_name?.name ?? '',
        versesCount: c.verses_count,
        revelation: c.revelation_place,
        bismillahPre: !!c.bismillah_pre,
      }));
    },
    async () => {
      const d = await getJSON(F.chapters);
      return d.chapters.map((c) => ({ ...c, bismillahPre: c.id !== 1 && c.id !== 9 }));
    },
  ));
}

/* ---------------- Verses ---------------- */

async function primaryVerses(n) {
  const tr = `${P.translations.fr},${P.translations.en}`;
  const url = (page) => `${P.base}/verses/by_chapter/${n}?language=fr&fields=text_uthmani&translations=${tr}&per_page=${P.perPage}&page=${page}`;
  const first = await getJSON(url(1));
  let verses = first.verses || [];
  const pages = first.pagination?.total_pages;
  if (pages && pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => getJSON(url(i + 2))));
    rest.forEach((r) => { verses = verses.concat(r.verses || []); });
  } else if (!pages && verses.length === P.perPage) {
    // pagination missing: keep reading until a short page
    for (let p = 2; ; p++) {
      const r = await getJSON(url(p));
      verses = verses.concat(r.verses || []);
      if (!r.verses || r.verses.length < P.perPage) break;
    }
  }
  return verses.map((v) => {
    const t = (id) => v.translations?.find((x) => x.resource_id === id)?.text;
    return {
      key: v.verse_key,
      number: v.verse_number,
      arabic: v.text_uthmani,
      fr: stripHtml(t(P.translations.fr)),
      en: stripHtml(t(P.translations.en)),
    };
  });
}

async function fallbackVerses(n) {
  const ed = F.editions;
  const [ar, fr, en] = await Promise.all(
    [ed.ar, ed.fr, ed.en].map((e) => getJSON(`${F.verses}/${e}/${n}.min.json`)),
  );
  return ar.chapter.map((v, i) => ({
    key: `${n}:${v.verse}`,
    number: v.verse,
    arabic: v.text,
    fr: fr.chapter[i]?.verse === v.verse ? fr.chapter[i].text : '',
    en: en.chapter[i]?.verse === v.verse ? en.chapter[i].text : '',
  }));
}

export function getSurah(n, expectedCount) {
  return cached(`surah:${n}`, async () => {
    const r = await withFallback(() => primaryVerses(n), () => fallbackVerses(n));
    r.data.sort((a, b) => a.number - b.number);
    if (expectedCount && r.data.length !== expectedCount) {
      throw new SourceError(`Données incomplètes : ${r.data.length}/${expectedCount} versets reçus.`);
    }
    return r;
  });
}

// The Bismillah shown above surahs is the text of 1:1, loaded from the source (never typed by hand).
export function getBismillah() {
  return cached('bismillah', () => withFallback(
    async () => (await getJSON(`${P.base}/verses/by_key/1:1?fields=text_uthmani`)).verse.text_uthmani,
    async () => (await getJSON(`${F.verses}/${F.editions.ar}/1/1.min.json`)).text,
  ));
}

/* ---------------- Tafsir ---------------- */

async function primaryTafsir(lang, s, a) {
  const d = await getJSON(`${P.base}/tafsirs/${P.tafsirs[lang]}/by_ayah/${s}:${a}`);
  const t = d.tafsir || {};
  const keys = Object.keys(t.verses || {}).sort((x, y) => +x.split(':')[1] - +y.split(':')[1]);
  return { kind: 'html', body: t.text || '', verseKeys: keys.length ? keys : [`${s}:${a}`], resourceName: t.resource_name };
}

async function fallbackTafsir(lang, s, a, count) {
  const slug = F.tafsirs[lang];
  const one = (i) => cached(`ft:${slug}:${s}:${i}`, () => getJSON(`${F.tafsir}/${slug}/${s}/${i}.json`));
  const base = (await one(a)).text || '';
  // The mirror repeats the same passage on every ayah it covers: find the range by comparing neighbours.
  let lo = a, hi = a;
  if (base.trim()) {
    for (const dir of [-1, 1]) {
      let i = a; let open = true;
      while (open) {
        const batch = [];
        for (let k = 1; k <= 4; k++) { const j = i + dir * k; if (j >= 1 && j <= count) batch.push(j); }
        if (!batch.length) break;
        const res = await Promise.all(batch.map((j) => one(j).catch(() => ({ text: null }))));
        for (let k = 0; k < batch.length; k++) {
          if (res[k].text === base) { i = batch[k]; } else { open = false; break; }
        }
      }
      if (dir < 0) lo = i; else hi = i;
    }
  }
  const verseKeys = [];
  for (let i = lo; i <= hi; i++) verseKeys.push(`${s}:${i}`);
  return { kind: 'text', body: base, verseKeys };
}

export function getTafsir(lang, s, a, count) {
  return cached(`tafsir:${lang}:${s}:${a}`, () => withFallback(
    () => primaryTafsir(lang, s, a),
    () => fallbackTafsir(lang, s, a, count),
  ));
}

/* ---------------- Tafsir HTML sanitiser ---------------- */

const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'DIV', 'B', 'STRONG', 'I', 'EM', 'BR', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'SUP', 'SUB']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON']);

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  const walk = (node) => {
    [...node.children].forEach((el) => {
      if (DROP.has(el.tagName)) { el.remove(); return; }
      walk(el);
      if (!ALLOWED.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
      [...el.attributes].forEach((at) => { if (!['class', 'lang', 'dir'].includes(at.name)) el.removeAttribute(at.name); });
    });
  };
  walk(root);
  return root;
}
