import { describe, it, expect } from 'vitest';

import { resolveBrowserVoice } from '@/lib/audio/browser-tts-preview';
import { detectSpeechLang } from '@/lib/audio/speech-language';

describe('detectSpeechLang', () => {
  it('detects Chinese by CJK ratio', () => {
    expect(detectSpeechLang('光合作用是植物生长的基础')).toBe('zh-CN');
  });

  it.each(['zh-TW', 'zh-CN', 'zh-HK', 'zh-Hant-TW'])(
    'preserves the Chinese interface locale %s for Chinese text',
    (locale) => {
      expect(detectSpeechLang('你好，這是一段測試語音。', locale)).toBe(locale);
    },
  );

  it('still detects Vietnamese ahead of a Chinese interface locale', () => {
    expect(detectSpeechLang('Xin chào cả lớp!', 'zh-TW')).toBe('vi-VN');
  });

  it('detects Japanese by kana even when its kanji cross the Han threshold', () => {
    // Real narration from a Japanese course: 32% kanji, above
    // CJK_LANG_THRESHOLD, which the Han count alone read as Chinese.
    expect(
      detectSpeechLang(
        '例えば、計算結果や名前などの情報をこの箱に保存しておくことで、後から簡単に取り出したり、再利用したりすることができるんです。',
        'ja-JP',
      ),
    ).toBe('ja-JP');
    expect(detectSpeechLang('本日の講義はこれで終了です。お疲れ様でした！', 'ja-JP')).toBe('ja-JP');
  });

  it('speaks a Japanese course in Japanese from a Chinese interface', () => {
    expect(detectSpeechLang('まずは、基本的な四則演算です。', 'zh-CN')).toBe('ja-JP');
  });

  it('still reads Chinese without kana as Chinese from a Japanese interface', () => {
    expect(detectSpeechLang('光合作用是植物生长的基础', 'ja-JP')).toBe('zh-CN');
  });

  it('detects Vietnamese by decisive letters (đ/ơ/ư/ê/ô)', () => {
    expect(detectSpeechLang('Xin chào cả lớp!')).toBe('vi-VN');
    expect(detectSpeechLang('Quang hợp ở thực vật diễn ra như thế nào?')).toBe('vi-VN');
    expect(detectSpeechLang('Hôm nay thầy rất vui được đồng hành cùng các em')).toBe('vi-VN');
  });

  it('detects Vietnamese by ă/â density without decisive letters', () => {
    expect(detectSpeechLang('Anh ăn cơm với cá và canh chua')).toBe('vi-VN');
  });

  it('falls back to en-US for plain English', () => {
    expect(detectSpeechLang('Photosynthesis is how plants grow')).toBe('en-US');
    expect(detectSpeechLang('OK.')).toBe('en-US');
    expect(detectSpeechLang('')).toBe('en-US');
  });

  it('does not misclassify French as Vietnamese', () => {
    expect(detectSpeechLang('Bonjour le monde')).toBe('en-US');
    expect(detectSpeechLang('café au lait')).toBe('en-US');
  });

  it('uses the runtime locale when the text has no strong language signal', () => {
    expect(detectSpeechLang('Guten Morgen', 'de-DE')).toBe('de-DE');
    expect(detectSpeechLang('OK.', 'zh-TW')).toBe('zh-TW');
    expect(detectSpeechLang('', 'de-DE')).toBe('de-DE');
    expect(detectSpeechLang('光合作用是植物生长的基础', 'de-DE')).toBe('zh-CN');
    expect(detectSpeechLang('Xin chào cả lớp!', 'de-DE')).toBe('vi-VN');
  });

  it('keeps an explicitly selected browser voice ahead of text and UI language', () => {
    const voice = { voiceURI: 'English voice', lang: 'en-GB' } as SpeechSynthesisVoice;
    expect(
      resolveBrowserVoice([voice], voice.voiceURI, '光合作用是植物生长的基础', 'de-DE'),
    ).toEqual({ voice, lang: 'en-GB' });
    expect(resolveBrowserVoice([voice], 'default', 'Guten Morgen', 'de-DE')).toEqual({
      voice: null,
      lang: 'de-DE',
    });
    expect(
      resolveBrowserVoice([voice], voice.voiceURI, '你好，這是一段測試語音。', 'zh-TW'),
    ).toEqual({ voice, lang: 'en-GB' });
    expect(resolveBrowserVoice([voice], 'default', '你好，這是一段測試語音。', 'zh-TW')).toEqual({
      voice: null,
      lang: 'zh-TW',
    });
  });

  it('speaks in the course language when no voice is selected', () => {
    const voice = { voiceURI: 'English voice', lang: 'en-GB' } as SpeechSynthesisVoice;
    expect(resolveBrowserVoice([voice], 'default', '正解！', 'de-DE', 'ja-JP')).toEqual({
      voice: null,
      lang: 'ja-JP',
    });
    expect(resolveBrowserVoice([voice], voice.voiceURI, '正解！', 'de-DE', 'ja-JP')).toEqual({
      voice,
      lang: 'en-GB',
    });
  });
});
