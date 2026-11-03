export const availableLocales = ['de', 'en'] as const;

export type AvailableLocale = (typeof availableLocales)[number];
