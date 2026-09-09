import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en_common from './locales/en/common.json';
import en_chat from './locales/en/chat.json';
import en_config from './locales/en/config.json';
import en_console from './locales/en/console.json';
import en_onboarding from './locales/en/onboarding.json';

import zh_common from './locales/zh-Hans/common.json';
import zh_chat from './locales/zh-Hans/chat.json';
import zh_config from './locales/zh-Hans/config.json';
import zh_console from './locales/zh-Hans/console.json';
import zh_onboarding from './locales/zh-Hans/onboarding.json';

import ja_common from './locales/ja/common.json';
import ja_chat from './locales/ja/chat.json';
import ja_config from './locales/ja/config.json';
import ja_console from './locales/ja/console.json';
import ja_onboarding from './locales/ja/onboarding.json';

import ko_common from './locales/ko/common.json';
import ko_chat from './locales/ko/chat.json';
import ko_config from './locales/ko/config.json';
import ko_console from './locales/ko/console.json';
import ko_onboarding from './locales/ko/onboarding.json';

import de_common from './locales/de/common.json';
import de_chat from './locales/de/chat.json';
import de_config from './locales/de/config.json';
import de_console from './locales/de/console.json';
import de_onboarding from './locales/de/onboarding.json';

import es_common from './locales/es/common.json';
import es_chat from './locales/es/chat.json';
import es_config from './locales/es/config.json';
import es_console from './locales/es/console.json';
import es_onboarding from './locales/es/onboarding.json';

const SUPPORTED_LOCALES = ['en', 'zh-Hans', 'ja', 'ko', 'de', 'es'] as const;

const deviceLang = getLocales()[0]?.languageCode ?? 'en';

// Map device language code to our supported locales.
// Chinese variants (zh-Hans, zh-Hant, zh) all resolve to zh-Hans for now.
function resolveLocale(code: string): string {
  if (code.startsWith('zh')) return 'zh-Hans';
  if ((SUPPORTED_LOCALES as readonly string[]).includes(code)) return code;
  return 'en';
}

i18n.use(initReactI18next).init({
  lng: resolveLocale(deviceLang),
  fallbackLng: 'en',
  ns: ['common', 'chat', 'config', 'console', 'onboarding'],
  defaultNS: 'common',
  resources: {
    en: {
      common: en_common,
      chat: en_chat,
      config: en_config,
      console: en_console,
      onboarding: en_onboarding,
    },
    'zh-Hans': {
      common: zh_common,
      chat: zh_chat,
      config: zh_config,
      console: zh_console,
      onboarding: zh_onboarding,
    },
    ja: {
      common: ja_common,
      chat: ja_chat,
      config: ja_config,
      console: ja_console,
      onboarding: ja_onboarding,
    },
    ko: {
      common: ko_common,
      chat: ko_chat,
      config: ko_config,
      console: ko_console,
      onboarding: ko_onboarding,
    },
    de: {
      common: de_common,
      chat: de_chat,
      config: de_config,
      console: de_console,
      onboarding: de_onboarding,
    },
    es: {
      common: es_common,
      chat: es_chat,
      config: es_config,
      console: es_console,
      onboarding: es_onboarding,
    },
  },
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
