import { getLocales } from 'expo-localization';

import { en, type Translation } from '@/locales/en';
import { es } from '@/locales/es';

export type Language = 'en' | 'es';

const dictionaries: Record<Language, Translation> = { en, es };

/** Device default language, falling back to English. */
export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return code === 'es' ? 'es' : 'en';
}

export function getDictionary(lang: Language): Translation {
  return dictionaries[lang] ?? en;
}
