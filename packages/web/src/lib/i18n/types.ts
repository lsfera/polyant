// SPDX-License-Identifier: AGPL-3.0-or-later

import type en from "./locales/en.json";

export type Locale = "it" | "en";
export const DEFAULT_LOCALE: Locale = "it";
export const LOCALES: Locale[] = ["it", "en"];

export type Translations = typeof en;
export type TranslationKey = keyof Translations;
