import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setModelSettingsViewForTests } from '../helpers/model-settings-view';

const mocks = vi.hoisted(() => ({
  audioGet: vi.fn(),
  audioBulkGet: vi.fn(),
  generateAndStoreTTS: vi.fn(),
  poolRemove: vi.fn(),
  stageState: { stage: null, scenes: [] } as {
    stage: Record<string, unknown> | null;
    scenes: unknown[];
  },
  audioRows: new Map<string, { id: string; stageId?: string }>(),
  accessDocument: vi.fn(),
  assetRefExists: vi.fn(),
  mayGenerate: vi.fn(),
}));

vi.mock('@/lib/classroom/generation-permission', () => ({
  mayGenerateForStage: mocks.mayGenerate,
}));

vi.mock('@/lib/media/use-asset-url', () => ({ assetRefExists: mocks.assetRefExists }));

vi.mock('@/lib/device-storage/database', () => ({
  db: {
    audioFiles: {
      get: mocks.audioGet,
      bulkGet: mocks.audioBulkGet,
    },
  },
}));

vi.mock('@/lib/document-store', () => ({ accessDocument: mocks.accessDocument }));

vi.mock('@/lib/audio/narration-tts', () => ({
  generateAndStoreTTS: mocks.generateAndStoreTTS,
}));

vi.mock('@/lib/media/asset-pool', () => ({
  removeAsset: mocks.poolRemove,
}));

vi.mock('@/lib/store/stage', () => ({
  useStageStore: { getState: () => mocks.stageState },
}));

import {
  regenerateSpeechAudio,
  resolveLegacySpeechAudioId,
  resolveSpeechAudioId,
} from '@/lib/audio/regenerate-speech-tts';

describe('allocated speech audio identities', () => {
  beforeEach(() => {
    mocks.mayGenerate.mockReset().mockReturnValue(true);
    mocks.audioGet.mockReset();
    mocks.generateAndStoreTTS.mockReset();
    mocks.poolRemove.mockReset().mockResolvedValue(undefined);
    mocks.stageState = { stage: null, scenes: [] };
    mocks.audioRows.clear();
    mocks.audioBulkGet.mockImplementation(async (ids: string[]) =>
      ids.map((id) => mocks.audioRows.get(id)),
    );
    mocks.accessDocument.mockReset().mockImplementation(async () => ({
      document: mocks.stageState.stage
        ? { stage: mocks.stageState.stage, scenes: mocks.stageState.scenes }
        : null,
      readOnlyLegacy: false,
    }));
    // The workspace's tts slot resolves to a server provider.
    setModelSettingsViewForTests({ tts: { registryId: 'managed-tts' } });
    mocks.assetRefExists.mockReset().mockResolvedValue(false);
  });

  it('treats a missing action audioId as no current audio', () => {
    expect(resolveSpeechAudioId(3, { id: 'speech-1' })).toBeUndefined();
    expect(mocks.audioGet).not.toHaveBeenCalled();
  });

  it('serves the deterministic key only when a cached row exists', async () => {
    mocks.audioGet.mockResolvedValueOnce({ id: 'tts_s3_speech-1' });
    await expect(resolveLegacySpeechAudioId(3, { id: 'speech-1' })).resolves.toBe(
      'tts_s3_speech-1',
    );

    mocks.audioGet.mockResolvedValueOnce(undefined);
    await expect(resolveLegacySpeechAudioId(3, { id: 'speech-2' })).resolves.toBeUndefined();
  });

  it('does not revive invalidated narration from a legacy derived-id row', async () => {
    await expect(
      resolveLegacySpeechAudioId(3, { id: 'speech-1', audioInvalidated: true }),
    ).resolves.toBeUndefined();
    expect(mocks.audioGet).not.toHaveBeenCalled();
  });

  // Regenerating narration calls the TTS provider and allocates a fresh pool
  // asset, so it is one of the ways generation starts and answers to the same
  // permission. The surfaces withhold the control; this is the precondition.
  it('refuses regeneration for a viewer who may not start generation', async () => {
    mocks.stageState = { stage: { id: 'stage-1' }, scenes: [] };
    mocks.mayGenerate.mockReturnValue(false);

    await expect(
      regenerateSpeechAudio(3, { id: 'speech-1', text: 'New narration' }),
    ).resolves.toBeNull();
    expect(mocks.generateAndStoreTTS).not.toHaveBeenCalled();
  });

  it('returns the freshly allocated id from regeneration', async () => {
    mocks.generateAndStoreTTS.mockResolvedValueOnce('ast_fresh_audio');

    await expect(regenerateSpeechAudio(3, { id: 'speech-1', text: 'New narration' })).resolves.toBe(
      'ast_fresh_audio',
    );
    expect(mocks.generateAndStoreTTS).toHaveBeenCalledWith(
      'tts_request_s3_speech-1',
      'New narration',
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('synthesizes in the language the course records, else the one its speech shows', async () => {
    mocks.generateAndStoreTTS.mockResolvedValue('ast_fresh_audio');
    const japaneseScene = { actions: [{ type: 'speech', text: '変数は箱です。' }] };
    for (const [stage, scenes, expected] of [
      // A recorded language wins over what the speech shows.
      [{ id: 'stage-1', languageCode: 'en-GB' }, [japaneseScene], 'en-GB'],
      [{ id: 'stage-1' }, [japaneseScene], 'ja-JP'],
      // Never the free-text language directive.
      [{ id: 'stage-1', languageDirective: 'Teach in English.' }, [], undefined],
    ] as const) {
      mocks.stageState = { stage: { ...stage }, scenes: [...scenes] };
      await regenerateSpeechAudio(3, { id: 'speech-1', text: 'New narration' });
      expect(mocks.generateAndStoreTTS.mock.lastCall?.[2]).toBe(expected);
    }
  });

  it('always forks to a fresh allocation, even for a clip only this line holds', async () => {
    // No browser can prove that no other document holds an id, so the old
    // bytes are never replaced in place: they keep serving any other holder.
    mocks.stageState = { stage: { id: 'stage-1' }, scenes: [] };
    mocks.generateAndStoreTTS.mockResolvedValueOnce('ast_fresh_audio');

    await expect(
      regenerateSpeechAudio(3, {
        id: 'speech-1',
        text: 'New narration',
        audioId: 'ast_only_here_audio',
      }),
    ).resolves.toBe('ast_fresh_audio');

    expect(mocks.generateAndStoreTTS).toHaveBeenCalledWith(
      'tts_request_s3_speech-1',
      'New narration',
      undefined,
      undefined,
      undefined,
      'stage-1',
    );
    expect(mocks.assetRefExists).not.toHaveBeenCalled();
  });

  it('allocates fresh speech audio before the old id is superseded', async () => {
    mocks.generateAndStoreTTS.mockResolvedValueOnce('ast_fresh_audio');

    await expect(
      regenerateSpeechAudio(3, {
        id: 'speech-1',
        text: 'Updated narration',
        audioId: 'ast_existing_audio',
      }),
    ).resolves.toBe('ast_fresh_audio');

    expect(mocks.generateAndStoreTTS).toHaveBeenCalledWith(
      'tts_request_s3_speech-1',
      'Updated narration',
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(mocks.poolRemove).not.toHaveBeenCalled();
  });
});
