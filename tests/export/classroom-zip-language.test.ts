import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';

const mocks = vi.hoisted(() => ({
  accessDocument: vi.fn(),
  prepareScenes: vi.fn(),
  buildAssetManifest: vi.fn(),
  collectAudioFiles: vi.fn(),
  collectMediaFiles: vi.fn(),
  collectLegacyAudioForExport: vi.fn(),
}));

vi.mock('@/lib/document-store', () => ({ accessDocument: mocks.accessDocument }));
vi.mock('@/lib/pbl/v2/runtime/document-persistence', () => ({
  preparePBLScenesForDocumentPersistence: mocks.prepareScenes,
}));
vi.mock('@/lib/media/asset-manifest', () => ({
  buildStageAssetManifest: mocks.buildAssetManifest,
}));
vi.mock('@/lib/export/classroom-zip-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export/classroom-zip-utils')>();
  return {
    ...actual,
    collectAudioFiles: mocks.collectAudioFiles,
    collectMediaFiles: mocks.collectMediaFiles,
    collectLegacyAudioForExport: mocks.collectLegacyAudioForExport,
  };
});

import { buildClassroomExportZip } from '@/lib/export/use-export-classroom';
import type { ClassroomManifest } from '@/lib/export/classroom-zip-types';
import type { Scene, Stage } from '@/lib/types/stage';

const stage = {
  id: 'stage-1',
  name: 'Python入門',
  languageDirective: '日本語で授業を行ってください。',
  languageCode: 'ja-JP',
  generatedAgentConfigs: [],
} as unknown as Stage;
const scenes = [
  {
    id: 'scene-1',
    stageId: stage.id,
    title: 'Scene',
    order: 0,
    type: 'slide',
    content: { type: 'slide', canvas: { elements: [] } },
    actions: [],
  } as unknown as Scene,
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accessDocument.mockResolvedValue({ document: { stage } });
  mocks.prepareScenes.mockResolvedValue(scenes);
  mocks.buildAssetManifest.mockResolvedValue({ version: 1, entries: [] });
  mocks.collectAudioFiles.mockResolvedValue([]);
  mocks.collectMediaFiles.mockResolvedValue([]);
  mocks.collectLegacyAudioForExport.mockResolvedValue({
    audioUrlToPath: new Map(),
    blobs: [],
    fullyRescuedAudioIds: new Set(),
  });
});

describe('buildClassroomExportZip course language', () => {
  it('writes the course language code beside its directive', async () => {
    const result = await buildClassroomExportZip(stage, scenes);
    const zip = await JSZip.loadAsync(await result.zip.arrayBuffer());
    const manifest = JSON.parse(
      await zip.file('manifest.json')!.async('string'),
    ) as ClassroomManifest;

    expect(manifest.stage).toMatchObject({
      language: '日本語で授業を行ってください。',
      languageCode: 'ja-JP',
    });
  });
});
