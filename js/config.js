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
  timeoutMs: 9000,
};

export const LABELS = {
  fr: 'Hamidullah (français)',
  en: 'Saheeh International (English)',
  tafsir: { en: 'Ibn Kathir — anglais (abrégé)', ar: 'Ibn Kathir — arabe (original)' },
};
