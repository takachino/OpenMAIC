import { describe, expect, it } from 'vitest';
import {
  courseLanguageVoice,
  speaksCourseLanguage,
  voiceSpeaksLanguage,
} from '@/lib/audio/voice-language';
import type { ConfiguredTTSVoice } from '@/lib/audio/types';

// The local Kokoro-FastAPI deployment's list: Japanese voices first, two English ones after.
const kokoroVoices: ConfiguredTTSVoice[] = [
  { id: 'jf_alpha', name: 'Alpha', language: 'ja-JP', gender: 'female' },
  { id: 'jf_gongitsune', name: 'Gongitsune', language: 'ja-JP', gender: 'female' },
  { id: 'jm_kumo', name: 'Kumo', language: 'ja-JP', gender: 'male' },
  { id: 'af_heart', name: 'Heart', language: 'en-US', gender: 'female' },
  { id: 'am_michael', name: 'Michael', language: 'en-US', gender: 'male' },
];

describe('voiceSpeaksLanguage', () => {
  it('compares the language of a provider whose voices set it', () => {
    expect(voiceSpeaksLanguage('lemonade-tts', 'en-US', 'ja-JP')).toBe(false);
    expect(voiceSpeaksLanguage('lemonade-tts', 'ja-JP', 'ja-JP')).toBe(true);
    // The region does not matter: an American voice speaks a British course.
    expect(voiceSpeaksLanguage('lemonade-tts', 'en-US', 'en-GB')).toBe(true);
    expect(voiceSpeaksLanguage('azure-tts', 'zh-CN', 'zh-TW')).toBe(true);
    expect(voiceSpeaksLanguage('azure-tts', 'ja', 'ja-JP')).toBe(true);
  });

  it('holds whenever either language is unknown', () => {
    expect(voiceSpeaksLanguage('lemonade-tts', 'en-US', undefined)).toBe(true);
    expect(voiceSpeaksLanguage('lemonade-tts', undefined, 'ja-JP')).toBe(true);
    expect(voiceSpeaksLanguage('lemonade-tts', 'auto', 'ja-JP')).toBe(true);
  });

  it('holds for a provider whose voices speak any language', () => {
    expect(voiceSpeaksLanguage('openai-tts', 'en', 'ja-JP')).toBe(true);
    expect(voiceSpeaksLanguage('qwen-tts', 'zh-CN', 'ja-JP')).toBe(true);
    expect(voiceSpeaksLanguage('custom-tts-kokoro', 'en-US', 'ja-JP')).toBe(true);
  });
});

describe('speaksCourseLanguage', () => {
  it('looks the voice up in the configured list, then the built-in catalogue', () => {
    expect(speaksCourseLanguage('lemonade-tts', 'af_heart', 'ja-JP')).toBe(false);
    expect(speaksCourseLanguage('lemonade-tts', 'jf_alpha', 'ja-JP')).toBe(true);
    expect(speaksCourseLanguage('lemonade-tts', 'am_michael', 'ja-JP', kokoroVoices)).toBe(false);
    expect(speaksCourseLanguage('lemonade-tts', 'bf_emma', 'ja-JP', kokoroVoices)).toBe(false);
  });

  it('holds for a voice that names no language, or a provider whose voices speak any', () => {
    expect(speaksCourseLanguage('lemonade-tts', 'my_voice', 'ja-JP')).toBe(true);
    expect(speaksCourseLanguage('openai-tts', 'alloy', 'ja-JP')).toBe(true);
    expect(speaksCourseLanguage('lemonade-tts', 'af_heart', undefined)).toBe(true);
  });
});

describe('courseLanguageVoice', () => {
  it('replaces a voice in another language with the first of the course language', () => {
    expect(courseLanguageVoice('lemonade-tts', 'af_heart', 'ja-JP')).toBe('jf_alpha');
    expect(courseLanguageVoice('azure-tts', 'zh-CN-XiaoxiaoNeural', 'en-US')).toBe(
      'en-US-JennyNeural',
    );
  });

  it('keeps the gender of the voice it replaces when the language has one', () => {
    expect(courseLanguageVoice('lemonade-tts', 'am_adam', 'ja-JP')).toBe('jm_kumo');
    expect(courseLanguageVoice('azure-tts', 'zh-CN-YunxiNeural', 'en-US')).toBe('en-US-GuyNeural');
  });

  it('prefers a voice of the course region when it replaces one', () => {
    expect(courseLanguageVoice('lemonade-tts', 'jf_alpha', 'en-GB')).toBe('bf_alice');
    expect(courseLanguageVoice('lemonade-tts', 'jm_kumo', 'en-GB')).toBe('bm_daniel');
    // A language with no voice of the course region still takes its first voice.
    expect(courseLanguageVoice('lemonade-tts', 'jf_alpha', 'en-AU')).toBe('af_alloy');
  });

  it('keeps a voice that speaks the course language, whatever its region', () => {
    expect(courseLanguageVoice('lemonade-tts', 'jf_nezumi', 'ja-JP')).toBe('jf_nezumi');
    expect(courseLanguageVoice('lemonade-tts', 'af_heart', 'en-GB')).toBe('af_heart');
  });

  it('keeps the voice when the course language or the voice language is unknown', () => {
    expect(courseLanguageVoice('lemonade-tts', 'af_heart', undefined)).toBe('af_heart');
    // A voice outside the catalogue (a clone, a voice the deployment added) says no language.
    expect(courseLanguageVoice('lemonade-tts', 'my_voice', 'ja-JP')).toBe('my_voice');
  });

  it('keeps the voice when the provider has none in the course language', () => {
    expect(courseLanguageVoice('lemonade-tts', 'af_heart', 'ko-KR')).toBe('af_heart');
    expect(courseLanguageVoice('azure-tts', 'zh-CN-XiaoxiaoNeural', 'ja-JP')).toBe(
      'zh-CN-XiaoxiaoNeural',
    );
  });

  it('chooses among the configured voices when the deployment lists them', () => {
    expect(courseLanguageVoice('lemonade-tts', 'jf_alpha', 'en-US', kokoroVoices)).toBe('af_heart');
    expect(courseLanguageVoice('lemonade-tts', 'jm_kumo', 'en-US', kokoroVoices)).toBe(
      'am_michael',
    );
    expect(courseLanguageVoice('lemonade-tts', 'am_michael', 'ja-JP', kokoroVoices)).toBe(
      'jm_kumo',
    );
    // The configured list has no British voice, so it takes the first English one.
    expect(courseLanguageVoice('lemonade-tts', 'jf_alpha', 'en-GB', kokoroVoices)).toBe('af_heart');
    // Nor any Spanish one.
    expect(courseLanguageVoice('lemonade-tts', 'jf_alpha', 'es-ES', kokoroVoices)).toBe('jf_alpha');
  });

  it('keeps a configured voice whose language the deployment did not give', () => {
    const voices: ConfiguredTTSVoice[] = [
      { id: 'narrator', name: 'Narrator' },
      { id: 'jf_alpha', name: 'Alpha', language: 'ja-JP' },
    ];
    expect(courseLanguageVoice('lemonade-tts', 'narrator', 'ja-JP', voices)).toBe('narrator');
  });

  it('keeps the voice of a provider whose voices speak any language', () => {
    expect(courseLanguageVoice('qwen-tts', 'Cherry', 'ja-JP')).toBe('Cherry');
    expect(courseLanguageVoice('openai-tts', 'alloy', 'ja-JP')).toBe('alloy');
  });
});
