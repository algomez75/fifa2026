import legalJson from '../../data/legal.json';

import type { Language } from './i18n';

export interface LegalSection {
  title: string;
  body: string;
}
interface LegalDoc {
  en: LegalSection[];
  es: LegalSection[];
}
interface LegalData {
  meta: {
    appName: string;
    entity: string;
    contact: string;
    location: string;
    updated: string;
  };
  privacy: LegalDoc;
  terms: LegalDoc;
}

export const legal = legalJson as LegalData;

export type LegalKind = 'privacy' | 'terms';

export function getLegal(kind: LegalKind, lang: Language): LegalSection[] {
  return legal[kind][lang] ?? legal[kind].en;
}
