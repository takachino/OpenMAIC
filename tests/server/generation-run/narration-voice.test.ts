/**
 * A run narrates with the browser's voice decisions: the slot voice or the
 * teacher's bound voice, the deterministic pick for an unusable pinned
 * narrator, the single retry after a missing clone, and the teacher's VoxCPM
 * options.
 */
import { describe, expect, it } from 'vitest';

import { resolveServerAgentVoiceOptions } from '@/lib/audio/agent-voice-options';
import { voiceBindingKey } from '@/lib/audio/unavailable-voice-bindings';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import {
  advertisedVoices,
  clipVoice,
  clipVoiceAfterMissingClone,
  narratorVoiceForGeneration,
  type RunNarrationTarget,
} from '@/lib/server/generation/run/narration-voice';
import type { MediaConnection } from '@/lib/server/model-config/media';

const qwen: RunNarrationTarget = {
  connection: {
    providerId: 'qwen-tts',
    managed: true,
    userEndpoint: false,
    origin: 'configuration',
  } as MediaConnection,
  providerId: 'qwen-tts',
  modelId: 'qwen3-tts-flash',
};
const clone = { providerId: 'qwen-tts' as const, voiceId: 'qwen-tts-vc-clone-1' };

describe('run narration voices', () => {
  it("uses the learner's voice for the slot's provider, else the provider default", () => {
    expect(
      clipVoice({
        target: qwen,
        preference: { providerId: 'qwen-tts', voiceId: 'Ethan' },
        bound: undefined,
        unavailable: new Set(),
      })?.voice.voiceId,
    ).toBe('Ethan');
    expect(
      clipVoice({
        target: qwen,
        preference: { providerId: 'openai-tts', voiceId: 'alloy' },
        bound: undefined,
        unavailable: new Set(),
      })?.voice.voiceId,
    ).toBe('Cherry');
  });

  it('prefers the bound teacher voice until this run found it unusable', () => {
    const bound = clipVoice({
      target: qwen,
      preference: undefined,
      bound: clone,
      unavailable: new Set(),
    });
    expect(bound?.voice.voiceId).toBe(clone.voiceId);
    const skipped = clipVoice({
      target: qwen,
      preference: undefined,
      bound: clone,
      unavailable: new Set([voiceBindingKey(clone)]),
    });
    expect(skipped?.voice.voiceId).toBe('Cherry');
  });

  it('retries a missing clone once: with the slot voice when the binding differs from it', () => {
    const chosen = clipVoice({
      target: qwen,
      preference: undefined,
      bound: clone,
      unavailable: new Set(),
    })!;
    expect(
      clipVoiceAfterMissingClone({
        target: qwen,
        bound: clone,
        globalVoice: chosen.globalVoice,
        failed: chosen.voice,
        usedFallbackVoice: false,
      })?.voiceId,
    ).toBe('Cherry');
    // A clip that did not use the binding is not retried.
    expect(
      clipVoiceAfterMissingClone({
        target: qwen,
        bound: clone,
        globalVoice: chosen.globalVoice,
        failed: chosen.globalVoice,
        usedFallbackVoice: false,
      }),
    ).toBeNull();
  });

  it('retries a pinned narrator (bound == slot voice) with the deterministic pick, once', () => {
    const pinned = clipVoice({
      target: qwen,
      preference: { providerId: 'qwen-tts', voiceId: clone.voiceId },
      bound: clone,
      unavailable: new Set(),
    })!;
    const retry = clipVoiceAfterMissingClone({
      target: qwen,
      bound: clone,
      globalVoice: pinned.globalVoice,
      failed: pinned.voice,
      usedFallbackVoice: false,
    });
    expect(retry).toMatchObject({ providerId: 'qwen-tts' });
    expect(retry?.voiceId).not.toBe(clone.voiceId);
    expect(
      clipVoiceAfterMissingClone({
        target: qwen,
        bound: clone,
        globalVoice: pinned.globalVoice,
        failed: pinned.voice,
        usedFallbackVoice: true,
      }),
    ).toBeNull();
  });

  describe('a course on a provider whose voice sets the language', () => {
    const kokoro: RunNarrationTarget = {
      connection: {
        providerId: 'lemonade-tts',
        managed: true,
        userEndpoint: false,
        origin: 'configuration',
        options: { defaultVoice: 'jf_alpha' },
        voices: [
          { id: 'jf_alpha', name: 'Alpha', language: 'ja-JP', gender: 'female' },
          { id: 'jm_kumo', name: 'Kumo', language: 'ja-JP', gender: 'male' },
          { id: 'af_heart', name: 'Heart', language: 'en-US', gender: 'female' },
          { id: 'am_michael', name: 'Michael', language: 'en-US', gender: 'male' },
        ],
      } as MediaConnection,
      providerId: 'lemonade-tts',
      modelId: 'kokoro',
    };

    it('pins the teacher to a voice of the course language, the default or the chosen one', () => {
      expect(narratorVoiceForGeneration(kokoro, undefined, 'en-US')?.voiceId).toBe('af_heart');
      expect(
        narratorVoiceForGeneration(
          kokoro,
          { providerId: 'lemonade-tts', voiceId: 'jm_kumo' },
          'en-US',
        )?.voiceId,
      ).toBe('am_michael');
      expect(narratorVoiceForGeneration(kokoro, undefined, 'ja-JP')?.voiceId).toBe('jf_alpha');
      expect(narratorVoiceForGeneration(kokoro, undefined, undefined)?.voiceId).toBe('jf_alpha');
    });

    it('offers the other agents only voices of the course language, when it has some', () => {
      const offered = (language?: string) =>
        advertisedVoices(kokoro, language).map((voice) => voice.voiceId);
      expect(offered('en-GB')).toEqual(['af_heart', 'am_michael']);
      expect(offered('ja-JP')).toEqual(['jf_alpha', 'jm_kumo']);
      expect(offered('es-ES')).toEqual(['jf_alpha', 'jm_kumo', 'af_heart', 'am_michael']);
      expect(offered(undefined)).toEqual(['jf_alpha', 'jm_kumo', 'af_heart', 'am_michael']);
    });

    it('leaves the voices of a provider whose voices speak any language', () => {
      expect(advertisedVoices(qwen, 'ja-JP')).toEqual(advertisedVoices(qwen));
      expect(narratorVoiceForGeneration(qwen, undefined, 'ja-JP')?.voiceId).toBe('Cherry');
    });
  });

  it('gives the VoxCPM auto voice its prompt from the teacher, as the browser does', async () => {
    const teacher = {
      id: 't',
      name: 'Ada',
      role: 'teacher',
      persona: 'Warm and patient.',
    } as AgentConfig;
    expect(
      await resolveServerAgentVoiceOptions(teacher, {
        providerId: 'voxcpm-tts',
        providerConfig: { providerOptions: { backend: 'vllm-omni' } },
        voiceId: 'voxcpm:auto',
        language: 'Use English.',
      }),
    ).toEqual({ backend: 'vllm-omni', voiceMode: 'auto', voicePrompt: 'Warm and patient.' });
    expect(
      await resolveServerAgentVoiceOptions(teacher, { providerId: 'openai-tts', voiceId: 'alloy' }),
    ).toBeUndefined();
  });
});
