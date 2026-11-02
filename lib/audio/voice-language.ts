/**
 * Voices for a course's language. Most providers' voices speak whatever
 * language the text is in; a provider whose voices each speak one language
 * (`voiceSetsLanguage`) garbles a course in another, so speech for a course
 * takes one of its voices in the course language. Pure, so the browser and
 * the server choose alike.
 */
import { TTS_PROVIDERS } from '@/lib/audio/constants';
import type { BuiltInTTSProviderId, ConfiguredTTSVoice } from '@/lib/audio/types';

interface CatalogueVoice {
  id: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
}

function languageOf(tag: string): string {
  return tag.toLowerCase().split(/[-_]/)[0];
}

function setsLanguage(providerId: string): boolean {
  return (
    Object.hasOwn(TTS_PROVIDERS, providerId) &&
    TTS_PROVIDERS[providerId as BuiltInTTSProviderId].voiceSetsLanguage === true
  );
}

/** A voice's language when it names one: `auto` (any language) and a blank do not. */
function namedLanguage(language: string | undefined): string | undefined {
  const trimmed = language?.trim();
  return trimmed && trimmed.toLowerCase() !== 'auto' ? trimmed : undefined;
}

/**
 * Whether a voice of this provider can speak `language` (a BCP 47 tag). Only
 * a provider whose voices set the language can fail, and only when both
 * languages are known and differ; the region does not count.
 */
export function voiceSpeaksLanguage(
  providerId: string,
  voiceLanguage: string | undefined,
  language: string | undefined,
): boolean {
  const voice = namedLanguage(voiceLanguage);
  if (!language || !voice || !setsLanguage(providerId)) return true;
  return languageOf(voice) === languageOf(language);
}

function builtInVoices(providerId: string): readonly CatalogueVoice[] {
  return TTS_PROVIDERS[providerId as BuiltInTTSProviderId].voices;
}

/** A voice's entry in the deployment's list, else in the built-in catalogue. */
function catalogueVoice(
  providerId: string,
  voiceId: string,
  configuredVoices?: readonly ConfiguredTTSVoice[],
): CatalogueVoice | undefined {
  return (
    configuredVoices?.find((voice) => voice.id === voiceId) ??
    builtInVoices(providerId).find((voice) => voice.id === voiceId)
  );
}

/**
 * Whether the voice `voiceId` can speak a course in `language`: a voice in
 * neither the deployment's list nor the built-in catalogue names no language,
 * so it can.
 */
export function speaksCourseLanguage(
  providerId: string,
  voiceId: string,
  language: string | undefined,
  configuredVoices?: readonly ConfiguredTTSVoice[],
): boolean {
  if (!language || !setsLanguage(providerId)) return true;
  return voiceSpeaksLanguage(
    providerId,
    catalogueVoice(providerId, voiceId, configuredVoices)?.language,
    language,
  );
}

/**
 * The voice to speak a course in `language` with: `voiceId` while it can
 * speak it, else the provider's first voice in that language, preferring the
 * replaced voice's gender and then the course's region; `voiceId` when the
 * provider has none. The voices are the deployment's list when it configures
 * one, else the built-in catalogue. A voice in neither (a clone, say) names no
 * language and stays.
 */
export function courseLanguageVoice(
  providerId: string,
  voiceId: string,
  language: string | undefined,
  configuredVoices?: readonly ConfiguredTTSVoice[],
): string {
  if (!language || !setsLanguage(providerId)) return voiceId;
  const current = catalogueVoice(providerId, voiceId, configuredVoices);
  if (!current || voiceSpeaksLanguage(providerId, current.language, language)) return voiceId;
  const catalogue = configuredVoices?.length ? configuredVoices : builtInVoices(providerId);
  let best: { id: string; score: number } | undefined;
  for (const voice of catalogue) {
    const voiceLanguage = namedLanguage(voice.language);
    if (!voiceLanguage || languageOf(voiceLanguage) !== languageOf(language)) continue;
    const score =
      (current.gender && voice.gender === current.gender ? 2 : 0) +
      (voiceLanguage.toLowerCase() === language.toLowerCase() ? 1 : 0);
    if (!best || score > best.score) best = { id: voice.id, score };
  }
  return best?.id ?? voiceId;
}
