import { describe, it, expect } from 'vitest';
import { normalizeLanguageCode } from '@openmaic/dsl';

describe('normalizeLanguageCode', () => {
  it.each([
    ['ja-JP', 'ja-JP'],
    ['zh-TW', 'zh-TW'],
    ['en-GB', 'en-GB'],
  ])('keeps the language-region tag %s', (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected);
  });

  it.each([
    ['ja', 'ja-JP'],
    ['zh', 'zh-CN'],
    ['en', 'en-US'],
    ['pt', 'pt-BR'],
  ])('fills in the likely region of a bare language %s', (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected);
  });

  it.each([
    ['zh-Hant', 'zh-TW'],
    ['zh-Hans-CN', 'zh-CN'],
    ['ja-JP-u-ca-japanese', 'ja-JP'],
  ])('drops the script and extension subtags of %s', (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected);
  });

  it.each([
    ['JA_jp', 'ja-JP'],
    ['  ja-jp ', 'ja-JP'],
  ])('accepts the casing, underscores and padding a model may write: %j', (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected);
  });

  it.each(['Japanese', 'xx', 'und', '', '   ', 'ja--JP'])('rejects %j', (input) => {
    expect(normalizeLanguageCode(input)).toBeUndefined();
  });

  it.each([undefined, null, 42, { language: 'ja' }])('rejects the non-string %j', (input) => {
    expect(normalizeLanguageCode(input)).toBeUndefined();
  });
});
