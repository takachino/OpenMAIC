import { setDeploymentConfigForTests } from '@/lib/server/model-config/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StepRefusal } from '@/lib/server/generation/steps/context';
import { synthesizeNarration } from '@/lib/server/generation/steps/narration';
import type { MediaConnection } from '@/lib/server/model-config/media';

import { jsonRequest, testLogger } from './helpers';

const mocks = vi.hoisted(() => ({
  generateTTS: vi.fn(),
  resolveMediaSlot: vi.fn(),
  recordGenerationUsage: vi.fn(),
}));

vi.mock('@/lib/audio/tts-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audio/tts-providers')>()),
  generateTTS: mocks.generateTTS,
}));
vi.mock('@/lib/server/model-config/media', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/model-config/media')>()),
  resolveMediaSlot: mocks.resolveMediaSlot,
}));
vi.mock('@/lib/server/usage-storage', () => ({
  recordGenerationUsage: mocks.recordGenerationUsage,
}));

const connection: MediaConnection = {
  providerId: 'openai-tts',
  modelId: 'gpt-4o-mini-tts',
  apiKey: 'server-key',
  managed: true,
  userEndpoint: false,
  origin: 'configuration',
};

describe('narration step', () => {
  beforeEach(() => {
    vi.resetModules();
    setDeploymentConfigForTests({
      layer: {
        source: 'deployment',
        config: {
          providers: {
            seedream: { preset: 'seedream', apiKey: 'image-key' },
            seedance: { preset: 'seedance', apiKey: 'video-key' },
            'openai-tts': { preset: 'openai-tts', apiKey: 'server-key' },
          },
          slots: { image: 'seedream', video: 'seedance', tts: 'openai-tts:gpt-4o-mini-tts' },
        },
      },
      legacy: false,
      notices: [],
    });
    mocks.generateTTS.mockReset();
    mocks.generateTTS.mockResolvedValue({ audio: new Uint8Array([1, 2, 3]), format: 'mp3' });
    mocks.resolveMediaSlot.mockReset();
    mocks.resolveMediaSlot.mockResolvedValue(connection);
    mocks.recordGenerationUsage.mockReset();
  });

  it('uses the connection default voice while preserving explicit requests', async () => {
    for (const [requestedVoice, expected] of [
      [undefined, 'vivian'],
      ['alloy', 'alloy'],
    ] as const) {
      await synthesizeNarration(
        {
          text: 'Hello',
          audioId: 'default-voice-test',
          connection: { ...connection, options: { defaultVoice: 'vivian' } },
          requestedVoice,
        },
        { log: testLogger() },
      );
      expect(mocks.generateTTS.mock.calls.at(-1)?.[0].voice).toBe(expected);
    }
  });

  it('uses the configured catalogue fallback without an explicit default', async () => {
    await synthesizeNarration(
      {
        text: 'Hello',
        audioId: 'catalogue-default-test',
        connection: { ...connection, voices: [{ id: 'vivian', name: 'Vivian' }] },
      },
      { log: testLogger() },
    );
    expect(mocks.generateTTS.mock.calls.at(-1)?.[0].voice).toBe('vivian');
  });

  it('speaks with the requested voice through the slot provider and records the usage', async () => {
    const trace: { providerId?: string; voice?: string } = {};
    const result = await synthesizeNarration(
      { text: 'Hello class', audioId: 'a1', connection, requestedVoice: 'nova', speed: 1.2, trace },
      { log: testLogger() },
    );

    expect(result).toEqual({
      audio: new Uint8Array([1, 2, 3]),
      format: 'mp3',
      providerId: 'openai-tts',
      modelId: 'gpt-4o-mini-tts',
    });
    expect(mocks.generateTTS).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'openai-tts',
        voice: 'nova',
        speed: 1.2,
        apiKey: 'server-key',
        managed: true,
      }),
      'Hello class',
    );
    expect(trace).toEqual({ providerId: 'openai-tts', voice: 'nova' });
    expect(mocks.recordGenerationUsage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'tts', quantity: 'Hello class'.length }),
    );
  });

  it("uses the provider's default voice for a voice chosen for another provider", async () => {
    await synthesizeNarration(
      {
        text: 'Hello',
        audioId: 'a1',
        connection,
        requestedProviderId: 'another-tts',
        requestedVoice: 'someone',
      },
      { log: testLogger() },
    );
    expect(mocks.generateTTS).toHaveBeenCalledWith(
      expect.objectContaining({ voice: 'alloy' }),
      'Hello',
    );
  });

  it('hands the course language to the provider', async () => {
    await synthesizeNarration(
      { text: 'こんにちは', audioId: 'a1', connection, requestedVoice: 'nova', language: 'ja-JP' },
      { log: testLogger() },
    );
    expect(mocks.generateTTS).toHaveBeenCalledWith(
      expect.objectContaining({ voice: 'nova', language: 'ja-JP' }),
      'こんにちは',
    );
  });

  describe('a provider whose voice sets the language', () => {
    const kokoro: MediaConnection = {
      providerId: 'lemonade-tts',
      deploymentProviderId: 'kokoro',
      modelId: 'kokoro',
      baseUrl: 'http://localhost:8880/v1',
      managed: true,
      userEndpoint: false,
      origin: 'configuration',
      options: { defaultVoice: 'jf_alpha' },
      voices: [
        { id: 'jf_alpha', name: 'Alpha', language: 'ja-JP', gender: 'female' },
        { id: 'jf_gongitsune', name: 'Gongitsune', language: 'ja-JP', gender: 'female' },
        { id: 'jm_kumo', name: 'Kumo', language: 'ja-JP', gender: 'male' },
        { id: 'af_heart', name: 'Heart', language: 'en-US', gender: 'female' },
        { id: 'am_michael', name: 'Michael', language: 'en-US', gender: 'male' },
      ],
    };

    async function spokenVoice(requestedVoice: string | undefined, language?: string) {
      const trace: { voice?: string } = {};
      await synthesizeNarration(
        { text: 'Hello', audioId: 'a1', connection: kokoro, requestedVoice, language, trace },
        { log: testLogger() },
      );
      expect(trace.voice).toBe(mocks.generateTTS.mock.calls.at(-1)?.[0].voice);
      return trace.voice;
    }

    it('speaks a course in a voice of its language, the default or a chosen one', async () => {
      expect(await spokenVoice(undefined, 'en-US')).toBe('af_heart');
      expect(await spokenVoice('jm_kumo', 'en-US')).toBe('am_michael');
    });

    it('keeps a voice that speaks the course language, or any voice without one', async () => {
      expect(await spokenVoice('jf_gongitsune', 'ja-JP')).toBe('jf_gongitsune');
      expect(await spokenVoice('af_heart', undefined)).toBe('af_heart');
    });

    it('warns and keeps the voice when the provider has none in the course language', async () => {
      const log = testLogger();
      await synthesizeNarration(
        { text: 'Hola', audioId: 'a1', connection: kokoro, language: 'es-ES' },
        { log },
      );
      expect(mocks.generateTTS.mock.calls.at(-1)?.[0].voice).toBe('jf_alpha');
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('es-ES'));
    });
  });

  it.each([
    [{ ...connection, apiKey: undefined }, 'missing-api-key'],
    [{ ...connection, providerId: 'browser-native-tts' }, 'client-side-provider'],
  ] as const)('refuses what it cannot synthesize (%#)', async (refused, reason) => {
    const failure = await synthesizeNarration(
      { text: 'Hello', audioId: 'a1', connection: refused, requestedVoice: 'nova' },
      { log: testLogger() },
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(StepRefusal);
    expect((failure as StepRefusal).reason).toBe(reason);
    expect(mocks.generateTTS).not.toHaveBeenCalled();
  });

  it('answers the route exactly as the step does', async () => {
    const body = { text: 'Hello class', audioId: 'a1', ttsVoice: 'nova', ttsSpeed: 1.2 };
    const { POST } = await import('@/app/api/generate/tts/route');
    const response = await POST(jsonRequest('http://localhost/api/generate/tts', body));
    expect(response.status).toBe(200);
    const routedCall = mocks.generateTTS.mock.calls[0];

    mocks.generateTTS.mockClear();
    const stepped = await synthesizeNarration(
      { text: 'Hello class', audioId: 'a1', connection, requestedVoice: 'nova', speed: 1.2 },
      { log: testLogger() },
    );
    expect(await response.json()).toEqual({
      success: true,
      audioId: 'a1',
      base64: Buffer.from(stepped.audio).toString('base64'),
      format: stepped.format,
    });
    expect(mocks.generateTTS.mock.calls[0]).toEqual(routedCall);
  });

  it('reads the course language a request sends, and ignores one that is not a language', async () => {
    const { POST } = await import('@/app/api/generate/tts/route');
    for (const [ttsLanguage, expected] of [
      ['ja', 'ja-JP'],
      ['en_GB', 'en-GB'],
      ['日本語で授業を行ってください。', undefined],
      [42, undefined],
    ] as const) {
      mocks.generateTTS.mockClear();
      const response = await POST(
        jsonRequest('http://localhost/api/generate/tts', {
          text: 'Hello class',
          audioId: 'a1',
          ttsVoice: 'nova',
          ttsLanguage,
        }),
      );
      expect(response.status).toBe(200);
      expect(mocks.generateTTS.mock.calls[0][0].language).toBe(expected);
    }
  });

  it('answers a refusal with the 400 the route always answered', async () => {
    mocks.resolveMediaSlot.mockResolvedValue({ ...connection, apiKey: undefined });
    const { POST } = await import('@/app/api/generate/tts/route');
    const response = await POST(
      jsonRequest('http://localhost/api/generate/tts', { text: 'Hi', audioId: 'a1' }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      errorCode: 'MISSING_API_KEY',
      error: 'No API key configured for TTS provider: openai-tts',
    });
  });
});
