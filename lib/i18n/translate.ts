import type { Messages } from './messages';

type Params = Record<string, string | number | boolean> | undefined;

type TranslateArgs = {
  messages: Messages;
  fallbackMessages: Messages;
  key: string;
  params?: Params;
};

function getValue(source: Messages, path: string) {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, source);
}

function formatMessage(value: string, params?: Params) {
  if (!params) return value;
  return Object.entries(params).reduce((result, [key, replacement]) => {
    return result.replaceAll(`{${key}}`, String(replacement));
  }, value);
}

export function translate({ messages, fallbackMessages, key, params }: TranslateArgs) {
  const raw = getValue(messages, key) ?? getValue(fallbackMessages, key) ?? key;
  return formatMessage(String(raw), params);
}
