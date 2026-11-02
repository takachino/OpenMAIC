/**
 * The language narration is spoken in, from the course's recorded language and
 * the characters of the text. Pure, so browser speech and server synthesis can
 * share it.
 */
import { normalizeLanguageCode } from '@openmaic/dsl';

import type { Scene, Stage } from '@/lib/types/stage';

const CJK_LANG_THRESHOLD = 0.3;

// U+0110/0111 (đ), U+01A0/01A1 (ơ), U+01AF/01B0 (ư) and the U+1EA0–U+1EF9
// precomposed block (ớ, ừ, ồ, ế, ấ, …) never occur in French or Romanian
// Latin, so one occurrence marks Vietnamese. Bare ă/â/ê/ô do occur in
// Romanian (and ê/ô in lone French words like "fête"), so they only count
// toward a ratio — this does not fully exclude Romanian prose, which is
// acceptable because narration chunks follow the course language.
const VI_DECIDER_RE = /[đĐơƠưƯẠ-ỹ]/;
const VI_BROAD_RE = /[ăâêôĂÂÊÔ]/g;
const VI_BROAD_THRESHOLD = 0.02;

// Hiragana (U+3040–U+309F), katakana (U+30A0–U+30FF) and the katakana
// phonetic extensions (U+31F0–U+31FF) occur in Japanese and never in Chinese,
// so their presence settles the language before Han characters are counted:
// Japanese narration is Han-heavy (a third of a sentence crosses
// CJK_LANG_THRESHOLD) and would otherwise be read by a Chinese voice, which
// pronounces the kanji in Mandarin. The ratio keeps a lone kana quoted inside
// Chinese prose from deciding the whole sentence.
const KANA_RE = /[぀-ヿㇰ-ㇿ]/g;
const KANA_MIN_RATIO = 0.05;

const HAN_RE = /[一-鿿㐀-䶿]/g;
const HAN_OR_KANA_RE = /[぀-ヿㇰ-ㇿ㐀-䶿一-鿿]/;
/** Sentence ends, as browser narration splits its chunks. */
const SENTENCE_END_RE = /(?<=[.!?。！？\n])/;

// Of an unrecorded course's sentences in Han characters or kana, the share
// with kana from which its narration is Japanese. Japanese sentences all but
// always carry kana (particles, verb endings); a Chinese course that teaches
// Japanese quotes kana in some sentences and explains in kana-free ones, so
// it stays well below.
const JAPANESE_SENTENCE_SHARE = 0.9;

function ratio(text: string, re: RegExp): number {
  return (text.match(re) || []).length / text.length;
}

function languageOf(tag: string): string {
  return tag.toLowerCase().split('-')[0];
}

/**
 * Detect Japanese/Chinese/Vietnamese text, retaining the UI's Chinese region
 * when available.
 */
export function detectSpeechLang(text: string, fallbackLang = 'en-US'): string {
  if (!text) return fallbackLang || 'en-US';
  const kanaRatio = ratio(text, KANA_RE);
  if (kanaRatio > KANA_MIN_RATIO) {
    return fallbackLang.toLowerCase().startsWith('ja') ? fallbackLang : 'ja-JP';
  }
  const cjkRatio = ratio(text, HAN_RE);
  if (cjkRatio > CJK_LANG_THRESHOLD) {
    // 汉字比例只能识别语言，不能区分地区；中文界面继续使用用户所在地区的音色。
    return fallbackLang.toLowerCase().startsWith('zh-') ? fallbackLang : 'zh-CN';
  }
  if (VI_DECIDER_RE.test(text)) return 'vi-VN';
  if (ratio(text, VI_BROAD_RE) > VI_BROAD_THRESHOLD) return 'vi-VN';
  return fallbackLang || 'en-US';
}

/**
 * The language to speak a narration chunk in. A course that records its
 * language is spoken in it, and a chunk switches only for a script that
 * language is not written in: kana outside a Japanese course, Han characters
 * in a course in neither Chinese nor Japanese, Vietnamese letters outside a
 * Vietnamese one. Kanji are Han characters, so a Japanese chunk without kana
 * stays Japanese where the Han count alone reads it as Chinese. Without a
 * course language the chunk's own characters decide, as in
 * {@link detectSpeechLang}.
 */
export function resolveSpeechLang(
  text: string,
  courseLang: string | undefined,
  locale = 'en-US',
): string {
  if (!courseLang) return detectSpeechLang(text, locale);
  const chineseLocale = languageOf(locale) === 'zh';
  // A Chinese course seen from a Chinese interface keeps the interface's
  // region, as Chinese text does without a course language.
  const course = languageOf(courseLang) === 'zh' && chineseLocale ? locale : courseLang;
  const language = languageOf(course);
  if (!text) return course;
  if (ratio(text, KANA_RE) > KANA_MIN_RATIO) return language === 'ja' ? course : 'ja-JP';
  if (ratio(text, HAN_RE) > CJK_LANG_THRESHOLD) {
    if (language === 'ja' || language === 'zh') return course;
    return chineseLocale ? locale : 'zh-CN';
  }
  if (VI_DECIDER_RE.test(text)) return language === 'vi' ? course : 'vi-VN';
  return course;
}

/**
 * The language a course's narration is spoken in: the one its generation
 * recorded or, for a course generated before languages were recorded,
 * Japanese when nearly all of its sentences in Han characters or kana carry
 * kana. Any other unrecorded course is undefined, and its narration is read
 * chunk by chunk.
 */
export function courseSpeechLanguage(
  stage: Pick<Stage, 'languageCode'> | null | undefined,
  scenes: readonly Pick<Scene, 'actions'>[],
): string | undefined {
  const recorded = normalizeLanguageCode(stage?.languageCode);
  if (recorded) return recorded;
  let hanOrKanaSentences = 0;
  let kanaSentences = 0;
  for (const scene of scenes) {
    for (const action of scene.actions ?? []) {
      if (action.type !== 'speech') continue;
      for (const sentence of action.text.split(SENTENCE_END_RE)) {
        if (!HAN_OR_KANA_RE.test(sentence)) continue;
        hanOrKanaSentences++;
        if (ratio(sentence, KANA_RE) > KANA_MIN_RATIO) kanaSentences++;
      }
    }
  }
  return hanOrKanaSentences > 0 && kanaSentences >= hanOrKanaSentences * JAPANESE_SENTENCE_SHARE
    ? 'ja-JP'
    : undefined;
}
