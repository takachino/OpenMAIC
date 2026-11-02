import { describe, it, expect } from 'vitest';

import { courseSpeechLanguage, resolveSpeechLang } from '@/lib/audio/speech-language';
import type { Scene } from '@/lib/types/stage';

// Narration from a Japanese course (「Python入門：30分集中講座」), every sentence with kana.
const JAPANESE_NARRATION = [
  'それでは、プログラミングの非常に重要な基礎である、変数（Variable）とデータ型（Data Types）について学んでいきましょう。',
  '例えば、計算結果や名前などの情報をこの箱に保存しておくことで、後から簡単に取り出したり、再利用したりすることができるんです。',
  'まずは、基本的な四則演算です。数学と同じで、カッコの中が最優先です。',
  'ループとは、同じ処理を何度も自動で行う仕組みのことです。',
  '関数にデータを受け渡したり、計算結果を受け取ったりする流れを理解しましょう。',
  '本日の講義はこれで終了です。お疲れ様でした！',
];

// A Chinese course that teaches Japanese: kana in its quotes, none in its explanations.
const CHINESE_NARRATION_TEACHING_JAPANESE = [
  '今天我们来学习日语里最常用的问候语。',
  '早上见面的时候，日本人会说「おはようございます」。这句话的意思是早上好。',
  '朋友之间可以简单地说「おはよう」。白天的问候是「こんにちは」。',
  '请大家跟着我读一遍：「ありがとうございます」「すみません」。',
  '大家明白了吗？接下来我们做一个小练习。',
];

function scenes(...texts: string[]): Pick<Scene, 'actions'>[] {
  return [{ actions: texts.map((text, i) => ({ id: `speech-${i}`, type: 'speech', text })) }];
}

describe('resolveSpeechLang', () => {
  it('reads a Japanese course in Japanese, including chunks without kana', () => {
    for (const text of ['正解！', '四則演算。', '第1問。', ...JAPANESE_NARRATION]) {
      expect(resolveSpeechLang(text, 'ja-JP', 'zh-CN')).toBe('ja-JP');
    }
  });

  it('reads text without a decisive script in the course language, not the interface one', () => {
    expect(resolveSpeechLang('Photosynthesis is how plants grow.', 'en-US', 'ja-JP')).toBe('en-US');
    expect(resolveSpeechLang('変数（Variable）。', 'ja-JP', 'de-DE')).toBe('ja-JP');
    expect(resolveSpeechLang('', 'ja-JP', 'en-US')).toBe('ja-JP');
  });

  it('keeps the interface region for a Chinese course seen from a Chinese interface', () => {
    expect(resolveSpeechLang('光合作用是植物生长的基础', 'zh-CN', 'zh-TW')).toBe('zh-TW');
    expect(resolveSpeechLang('OK.', 'zh-CN', 'zh-HK')).toBe('zh-HK');
    expect(resolveSpeechLang('光合作用是植物生长的基础', 'zh-CN', 'ja-JP')).toBe('zh-CN');
  });

  it('switches only for a script the course language is not written in', () => {
    expect(resolveSpeechLang('「おはようございます」是早上好的意思。', 'zh-CN', 'zh-CN')).toBe(
      'ja-JP',
    );
    expect(resolveSpeechLang('光合作用是植物生长的基础', 'en-US', 'en-US')).toBe('zh-CN');
    expect(resolveSpeechLang('光合作用是植物生长的基础', 'en-US', 'zh-TW')).toBe('zh-TW');
    expect(resolveSpeechLang('Xin chào cả lớp!', 'ja-JP', 'ja-JP')).toBe('vi-VN');
  });

  it('does not let ă/â density alone take a recorded course away from its language', () => {
    expect(resolveSpeechLang('Mâine învățăm în clasă.', 'ro-RO', 'en-US')).toBe('ro-RO');
  });

  it('reads each chunk by its own characters when the course language is unknown', () => {
    expect(resolveSpeechLang('光合作用是植物生长的基础', undefined, 'ja-JP')).toBe('zh-CN');
    expect(resolveSpeechLang('Guten Morgen', undefined, 'de-DE')).toBe('de-DE');
    expect(resolveSpeechLang('まずは、基本的な四則演算です。', undefined, 'zh-CN')).toBe('ja-JP');
    expect(resolveSpeechLang('Mâine învățăm în clasă.', undefined, 'en-US')).toBe('vi-VN');
  });
});

describe('courseSpeechLanguage', () => {
  it('uses the recorded language, normalized', () => {
    expect(
      courseSpeechLanguage({ languageCode: 'ja-JP' }, scenes('光合作用是植物生长的基础')),
    ).toBe('ja-JP');
    expect(courseSpeechLanguage({ languageCode: 'zh-Hant' }, [])).toBe('zh-TW');
  });

  it('settles an unrecorded Japanese course from its narration as a whole', () => {
    expect(courseSpeechLanguage({}, scenes(...JAPANESE_NARRATION))).toBe('ja-JP');
    expect(courseSpeechLanguage({ languageCode: 'Japanese' }, scenes(...JAPANESE_NARRATION))).toBe(
      'ja-JP',
    );
  });

  it('tolerates a stray kana-free sentence in a Japanese course', () => {
    const narration = [...JAPANESE_NARRATION, ...JAPANESE_NARRATION, '正解！'];
    expect(courseSpeechLanguage(null, scenes(...narration))).toBe('ja-JP');
  });

  it('leaves a Chinese course that quotes Japanese to the per-chunk reading', () => {
    expect(courseSpeechLanguage(null, scenes(...CHINESE_NARRATION_TEACHING_JAPANESE))).toBe(
      undefined,
    );
  });

  it('leaves any other unrecorded course to the per-chunk reading', () => {
    expect(courseSpeechLanguage(undefined, scenes('Photosynthesis is how plants grow.'))).toBe(
      undefined,
    );
    expect(courseSpeechLanguage({}, scenes('光合作用是植物生长的基础。'))).toBeUndefined();
    expect(courseSpeechLanguage({}, [{}, { actions: [] }])).toBeUndefined();
  });
});
