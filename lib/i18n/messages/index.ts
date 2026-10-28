import { ar } from './ar';
import { en } from './en';
import type { Locale } from '../locales';

export type Messages = Record<string, unknown>;

export const messages: Record<Locale, Messages> = { ar, en };

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages.en;
}
