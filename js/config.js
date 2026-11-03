// Data sources. Every ID below was checked against the live source lists
// (api.quran.com/api/v4/resources/translations and /resources/tafsirs) on 2026-11-03.
export const CONFIG = {
  primary: {
    name: 'Quran.com API v4',
    url: 'https://quran.com',
    base: 'https://api.quran.com/api/v4',
    // /resources/translations : 31 = Muhammad Hamidullah (french), 20 = Saheeh International (english)
    translations: { fr: 31, en: 20 },
    // /resources/tafsirs : 169 = Ibn Kathir (Abridged), english ; 14 = Tafsir Ibn Kathir, arabic
    tafsirs: { en: 169, ar: 14 },
    perPage: 50,
  },
  // Used automatically only if the primary API cannot be reached.
  fallback: {
    name: 'Miroir statique (jsDelivr)',
    verses: 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions',
    editions: {
      ar: 'ara-quranuthmanihaf', // King Fahd Glorious Quran Printing Complex, Uthmani Hafs v13
      fr: 'fra-muhammadhamidul', // Hamidullah, via Tanzil.net
      en: 'eng-ummmuhammad',     // Saheeh International (Umm Muhammad), via Tanzil.net
    },
    chapters: 'data/chapters-fallback.json',
    tafsir: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@v1.2.2/tafsir',
    tafsirs: { en: 'en-tafisr-ibn-kathir', ar: 'ar-tafsir-ibn-kathir' },
  },
  // French tafsir: not offered by api.quran.com/api/v4/resources/tafsirs, so it is always
  // loaded from the static dataset. "Al-Mukhtasar fi Tafsir al-Quran al-Karim" (Markaz Tafsir
  // lil-Dirasat al-Qur'aniyya), French edition = QUL / Tarteel resource 259, slug french-mokhtasar.
  frenchTafsir: {
    name: 'Al-Mukhtasar (QUL n° 259) via spa5k/tafsir_api',
    slug: 'french-mokhtasar',
    bases: [
      'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@v1.2.2/tafsir',
      'https://fastly.jsdelivr.net/gh/spa5k/tafsir_api@v1.2.2/tafsir',
    ],
  },
  timeoutMs: 9000,
};

export const LABELS = {
  fr: 'Hamidullah (français)',
  en: 'Saheeh International (English)',
  tafsir: { fr: 'Al-Mukhtasar fi Tafsir al-Qur’an — français', en: 'Ibn Kathir — anglais (abrégé)', ar: 'Ibn Kathir — arabe (original)' },
  tafsirTitle: { fr: 'Tafsir Al-Mukhtasar', en: 'Tafsir Ibn Kathir', ar: 'Tafsir Ibn Kathir' },
};
