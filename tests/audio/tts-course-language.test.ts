import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTTS } from '@/lib/audio/tts-providers';
import type { TTSModelConfig } from '@/lib/audio/types';

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/audio-provider-fetch', () => ({
  audioProviderFetch: (url: string, init?: RequestInit) => fetchMock(url, init),
  audioEndpointPolicy: () => ({}),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function audioResponse(): Response {
  return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04]), {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

/** The JSON body of the provider request. */
function sentBody(): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('Qwen TTS language_type', () => {
  const qwen = (language?: string): TTSModelConfig => ({
    providerId: 'qwen-tts',
    apiKey: 'test-key',
    voice: 'Cherry',
    ...(language ? { language } : {}),
  });

  /** The `input.language_type` Qwen is asked for; the audio URL is left out, which ends the call. */
  async function languageType(language?: string): Promise<unknown> {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(jsonResponse({ output: {} }));
    await expect(generateTTS(qwen(language), 'テキスト')).rejects.toThrow('no audio URL');
    return (sentBody().input as Record<string, unknown>).language_type;
  }

  it('names the course language', async () => {
    expect(await languageType('ja-JP')).toBe('Japanese');
    expect(await languageType('en-GB')).toBe('English');
    expect(await languageType('zh-TW')).toBe('Chinese');
    expect(await languageType('pt-BR')).toBe('Portuguese');
  });

  it('lets Qwen detect a language it does not name, or an unknown one', async () => {
    expect(await languageType('vi-VN')).toBe('Auto');
    expect(await languageType(undefined)).toBe('Auto');
  });
});

describe('MiniMax TTS language_boost', () => {
  const minimax = (language?: string): TTSModelConfig => ({
    providerId: 'minimax-tts',
    apiKey: 'test-key',
    baseUrl: 'https://api.minimaxi.com',
    voice: 'female-yujie',
    modelId: 'speech-2.8-hd',
    ...(language ? { language } : {}),
  });

  async function languageBoost(language?: string): Promise<unknown> {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { audio: '00ff' }, base_resp: { status_code: 0 } }),
    );
    await generateTTS(minimax(language), 'text');
    return sentBody().language_boost;
  }

  it('boosts the course language', async () => {
    expect(await languageBoost('ja-JP')).toBe('Japanese');
    expect(await languageBoost('en-US')).toBe('English');
    expect(await languageBoost('zh-CN')).toBe('Chinese');
    expect(await languageBoost('yue-HK')).toBe('Chinese,Yue');
    expect(await languageBoost('nb-NO')).toBe('Norwegian');
  });

  it('keeps detecting a language MiniMax does not name, or an unknown one', async () => {
    expect(await languageBoost('sw-KE')).toBe('auto');
    expect(await languageBoost(undefined)).toBe('auto');
    // Chinese in Hong Kong may be read in Cantonese or Mandarin: the voice decides.
    expect(await languageBoost('zh-HK')).toBe('auto');
  });
});

describe('ElevenLabs TTS language_code', () => {
  const elevenLabs = (modelId: string, language?: string): TTSModelConfig => ({
    providerId: 'elevenlabs-tts',
    apiKey: 'test-key',
    voice: 'EXAVITQu4vr4xnSDxMaL',
    modelId,
    ...(language ? { language } : {}),
  });

  async function body(modelId: string, language?: string): Promise<Record<string, unknown>> {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(audioResponse());
    await generateTTS(elevenLabs(modelId, language), 'text');
    return sentBody();
  }

  it('enforces the course language on a model that takes one', async () => {
    expect((await body('eleven_flash_v2_5', 'ja-JP')).language_code).toBe('ja');
    expect((await body('eleven_flash_v2_5', 'fil-PH')).language_code).toBe('fil');
  });

  it('sends no language to Multilingual v2, which does not take one', async () => {
    expect(await body('eleven_multilingual_v2', 'ja-JP')).not.toHaveProperty('language_code');
  });

  it('sends no language when the course has none', async () => {
    expect(await body('eleven_flash_v2_5')).not.toHaveProperty('language_code');
  });
});

describe('providers whose voice sets the language', () => {
  it('leave the request as it was: the voice follows the course language instead', async () => {
    fetchMock.mockResolvedValueOnce(audioResponse());
    await generateTTS(
      { providerId: 'lemonade-tts', voice: 'jf_alpha', language: 'ja-JP' },
      'テキスト',
    );
    expect(sentBody()).toEqual({
      model: 'kokoro-v1',
      input: 'テキスト',
      voice: 'jf_alpha',
      speed: 1.0,
      response_format: 'wav',
    });
  });
});
