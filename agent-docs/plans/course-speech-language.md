# 講座の読み上げ言語

日本語の講座の一部の文が中国語の声で読まれる問題を、講座の言語を記録して読み上げに使うことで根本から直す。

- 作成: 2026-11-02
- 状態: 第 1 段階 実装済み (フォーク takachino/OpenMAIC の main にコミット)。次は Lemonade (Kokoro) の準備

## 背景

- ブラウザ読み上げは、発話を `。！？` で文に分け、文ごとに文字の種類から言語を推測している (`lib/playback/engine.ts` → `detectSpeechLang`)。漢字が文字数の 30% を超える文は中国語 (zh-CN) と判定される。
- 「Python入門：30分集中講座」では 104 文のうち 15 文が中国語と判定されていた。原稿は日本語。
- 講座の言語は生成時に分かっているが、`Stage.languageDirective` (自由記述の文章) にしか残っていない。機械可読な言語コードがないので、再生側は推測するしかない。
- 日本語と中国語は漢字を共有するので、かなのない文 (例: 「正解！」) は文字だけでは区別できない。手がかりのない文は講座ではなく UI の言語で読まれる。
- サーバー側 TTS は `detectSpeechLang` を通らないが、言語は声とプロバイダーの設定で決まる (Qwen は `language_type: 'Chinese'` 固定、Azure などの既定の声は中国語)。

## 方針

1. 講座の言語を BCP 47 の言語コード (地域付き、例 `ja-JP`) として `Stage.languageCode` に記録する。アウトライン生成で LLM に出力させ、正規化して検証する。
2. 読み上げは講座の言語コードを第一の根拠にする。文字からの判定は、講座の言語では書かれない文字 (中国語の講座の中のかな、など) を拾う補助に回す。
3. 言語コードのない既存の講座は、講座全体の発話から日本語かどうかだけを判定する。それ以外は今までどおり文ごとの判定に任せる。

## 第 1 段階: 言語コードの記録とブラウザ読み上げ

### 設計

**データ**

- `packages/@openmaic/dsl/src/stage.ts`: `Stage.languageCode?: string` を追加する。任意項目なので既存の文書はそのまま有効。Stage は `document_stages.data` (jsonb) に丸ごと保存されるので DB の移行は不要。
- `normalizeLanguageCode(value: unknown): string | undefined` を DSL に置く。生成 (サーバー)・生成パッケージ・クライアントのすべてが使うため。
  - `_` を `-` に置き換え、`Intl.Locale` で解析して `maximize()` し、`言語-地域` を返す (`ja` → `ja-JP`、`zh-Hant` → `zh-TW`、`zh-Hans-CN` → `zh-CN`)。
  - 言語が 2〜3 文字でないもの、`und`、地域が決まらないもの、文字列でないものは `undefined`。

**生成**

- プロンプト (`packages/@openmaic/generation/templates/requirements-to-outlines/system.md` と `user.md`): トップレベルに `languageCode` を追加する。発話の言語 (教える言語) のコードで、外国語学習なら学ぶ言語ではなく教える言語。
- ストリーミング解析 (`lib/server/generation/steps/outline.ts`): `courseTitle` と同じく先頭 8KB から取り出し、見つからなければ完了後に全体から一度だけ探す。正規化して `OutlineResult.languageCode` に入れる。
- 非ストリーミング解析 (`packages/@openmaic/generation/src/outline-generator.ts`): 同様に `languageCode` を返す。
- ラン (`lib/server/generation/run/types.ts`, `engine.ts`): `GenerationRunOutline.languageCode?` を足し、確定したアウトラインから Stage に写す。アウトラインは jsonb にスプレッドで保存されるので、編集・確定を経ても残る。

**読み上げ言語の決定 (クライアント)**

- 純粋な関数を `lib/audio/speech-language.ts` に集める (`'use client'` を付けない。第 2 段階でサーバーからも使うため)。`detectSpeechLang` もここへ移す。
- `resolveSpeechLang(text, courseLang, locale)`: 講座の言語コードがあるときの文ごとの判定。

| 文の文字 | 講座の言語コードあり | 講座の言語コードなし (今までどおり) |
|---|---|---|
| かなが 5% 超 | 講座が日本語ならその言語、それ以外は `ja-JP` | `ja-JP` (UI が ja なら UI の値) |
| 漢字が 30% 超 | 講座が日本語か中国語ならその言語、それ以外は `zh-CN` (UI が zh なら UI の値) | `zh-CN` (UI が zh なら UI の値) |
| ベトナム語にしかない文字 | 講座がベトナム語ならその言語、それ以外は `vi-VN` | `vi-VN` |
| ă/â/ê/ô が多い | 講座の言語 | `vi-VN` |
| それ以外 | 講座の言語 | UI の言語 |

  - 中国語の講座を中国語の UI で見るときは UI の地域を使う (#1935 の「中国語は利用者の地域の声で読む」を保つ)。
- `courseSpeechLanguage(stage, scenes)`: 講座の言語。
  - `stage.languageCode` を正規化できればそれ。
  - なければ全シーンの発話を連結し、かなが文字全体の 5% を超え、かつかなと漢字のうちかなが 40% 以上なら `ja-JP`。それ以外は `undefined` (今までどおり文ごとの判定)。日本語を教える中国語の講座 (かなの引用が多い) を日本語と誤判定しないための条件。
- 講義の再生: `PlaybackEngineCallbacks.getSpeechLanguage?: () => string | undefined` を足し、`PlaybackChromeRoot` がストアから `courseSpeechLanguage` を渡す。文ごとに `resolveSpeechLang` を使う。声を明示的に選んでいる場合は今までどおりその声。
- ディスカッション: `use-discussion-tts.ts` がストアから講座の言語を求め、`useBrowserTTS` → `resolveBrowserVoice` に渡す。
- 設定画面のプレビューは講座と無関係なので変えない。

**エクスポート / インポート**

- `ManifestStage` に `languageCode?` を足して書き出し、読み込み時に正規化する。マニフェストの `language` は従来どおり `languageDirective` の文章 (名前は変えない)。

### 作業手順 (TDD)

- [x] 1. DSL: `normalizeLanguageCode` のテスト → 実装、`Stage.languageCode` を追加 (`packages/@openmaic/dsl/src/stage.ts`、テストは `test/language-code.test.ts`。0.12.1 に上げてビルド済み)
- [x] 2. `lib/audio/speech-language.ts`: `detectSpeechLang` を移し、`resolveSpeechLang` と `courseSpeechLanguage` のテスト → 実装 (`tests/audio/speech-language.test.ts`。`resolveBrowserVoice` に講座の言語の引数を追加)
  - 既存講座の推定は「漢字かかなを含む文のうち、かなを含む文が 90% 以上」に変更した。かなと漢字の文字数の比だと、実データの日本語講座 0.73 に対し、中国語で日本語を教える例が 0.34 で差が小さい。文の割合なら 1.00 と 0.56 で、中国語の講座を日本語と誤判定しにくい。
- [x] 3. 講義の再生: エンジンのテスト (`tests/playback/speech-locale.test.ts`) → `getSpeechLanguage` と `PlaybackChromeRoot` の配線
- [x] 4. ディスカッション: フックのテスト (`tests/hooks/speech-locale.test.ts`) → `use-discussion-tts.ts` と `use-browser-tts.ts`
  - 注意: `tests/audio/tts-invalid-response.test.ts` はリポジトリ直下のローカル設定 `openmaic.yml` (`tts: browser-native-tts`) を読んで失敗する。変更とは無関係で、`OPENMAIC_CONFIG` に空のファイルを指定すれば通る。
- [x] 5. 生成: アウトライン解析のテスト (ストリーミング / 非ストリーミング) → プロンプト・解析・ラン・Stage
  - プロンプトは 3 種類ある。パッケージの `requirements-to-outlines` と、アプリ側の `lib/prompts/templates/interactive-outlines` と `task-engine-outlines` (インタラクティブモードと職業訓練モード)。3 つとも `languageCode` を足した。
  - ラン結合テスト (`tests/server/generation-runs.pg.test.ts`) は、使い捨ての PostgreSQL コンテナを `PG_CONTRACT_URL` に指定して流した (開発用 DB は使っていない)。
- [x] 6. エクスポート / インポート (`tests/export/classroom-zip-language.test.ts`、`tests/import/server-backed-import-flow.test.ts`)
- [x] 7. パッケージのバージョン (`@openmaic/dsl` 0.12.0 → 0.12.1、`@openmaic/generation` 0.3.28 → 0.3.29。0.x の互換な追加なので patch)
- [x] 8. 全体確認: 関係するテスト、型チェック、lint、`pnpm check:package-versions`、実データ (「Python入門」) で中国語判定が 0 件になることの再確認
  - 型チェック (`tsc --noEmit`)、ESLint、Prettier は通過。DSL のテスト 313 件と型チェック、生成パッケージの型チェックも通過。
  - 生成パッケージ: アウトラインのプロンプトのスナップショット (`test/__snapshots__/outline-prompt.test.ts.snap`) を更新した。差分は `languageCode` を足した行だけ。`interactive-library-mapper.test.ts` の 2 件 (`^` を含むバージョン範囲) は今回の変更と無関係で、Node 24 で失敗する (`.nvmrc` は 22)。
  - アプリ全体: HEAD のクリーンな worktree (CI と同じく `openmaic.yml` も `.env.local` もない状態) と比べた。HEAD でも 4 ファイル 44 件が失敗し (`tests/runtime/chat-storage`、`tests/quiz/runtime`、`tests/utils/course-thumbnail-cache`、`tests/api/export-video-render-mixed-pool`)、変更後も同じ 44 件だけが失敗する。新しい失敗はない。
  - `check:package-versions` はコミット済みの差分 (`base...HEAD`) しか見ないので、コミット後に流す。
  - 実データ: 「Python入門」の 104 文は、言語コードなし (推定) でも `ja-JP` を記録した場合でも、UI が ja / zh / en のどれでもすべて `ja-JP` になった (変更前は 15 文が zh-CN)。
  - 未確認: 実際の LLM (ローカルの Ollama) が `languageCode` を出力するか。講座を新しく生成して `document_stages.data->>'languageCode'` を確かめる。

### スコープ外

- 日本語の講座の中の英語の文を英語の声で読むこと (今も UI の言語で読んでいる。講座の言語で読むようになるだけで、悪化はしない)。
- エージェント (Pro モード) や PBL など、アウトライン生成を通らない作り方の講座に言語コードを付けること。既存講座と同じ推定に任せる。
- 既存の講座に言語コードを書き込む移行。推定は読み上げのたびに行い、保存しない。

## Lemonade (Kokoro) の準備

ランタイムのインストールは利用者が行う (グローバル規約)。手順の案内と動作確認を担当する。

- Lemonade は macOS (Apple Silicon、Metal) と Windows / Linux (x86_64、CPU) で Kokoro を動かせる。WSL2 はドキュメントで未確認。
- API は `POST http://localhost:13305/v1/audio/speech` で、アプリの既定値 (`lib/audio/constants.ts` の `lemonade-tts`) と一致する。
- 未確認: 日本語の声 (`jf_alpha` など) と日本語テキストへの対応。存在しない声を指定すると無音が返るので、無音でないかを確かめる。

手順:

1. [ ] 利用者が `brew install --cask lemonade-server` で入れる (中身は公式の `Lemonade-<version>-Darwin.pkg`。Windows ではリリースの MSI)
2. [ ] `lemonade status` でサーバーを確認し、`lemonade pull kokoro-v1` (または `lemonade run kokoro-v1`) でモデルを用意する
3. [ ] `curl` で日本語の文を `jf_alpha` で合成し、無音でないことと読み方 (利用者が聞く) を確かめる
4. [ ] `openmaic.yml` の `tts` スロットを Lemonade にし、講座で確認する
5. [ ] 日本語が使えない場合の代替を検討する (日本語対応の Kokoro サーバーをカスタムの OpenAI 互換プロバイダーとして使う、など)

## 第 2 段階: サーバー側 TTS

第 1 段階と Lemonade の確認が終わってから詳細化する。

- `TTSModelConfig.language?` (BCP 47) を足し、生成時の合成・講義音声の再生成・ディスカッションの 3 経路から講座の言語を渡す。
- 各プロバイダーのモジュールで変換する (共有層は BCP 47 を渡すだけ)。
  - Qwen: `language_type` を言語コードから決める (分からなければ `Auto`)。固定値 `Chinese` を直す。
  - MiniMax: `language_boost` (`Japanese` が正式な値かは公式リファレンスで確認)。
  - ElevenLabs: モデルが対応していれば `language_code` (要確認)。
  - Azure、Kokoro: 声で言語が決まるので、声の選び方で対応する。
- 声の選び方: 講座の言語と合わない声を警告し、自動選択でも言語が合う声を優先する。
- VoxCPM の声登録用サンプル文の `language` に、`languageDirective` の文章や UI ロケールではなく言語コードを渡す。
- 保存済みの音声は変わらないので、必要なら再生成する。

## 未決事項とリスク

- 小さなローカルモデルが `languageCode` を出さない、または不正な値を出すことがある。その場合は既存講座と同じ推定に任せる。
- Lemonade の Kokoro (Kokoros バックエンド) が日本語を正しく読めるかは未確認。
- コミット (決定済み): フォーク `takachino/OpenMAIC` の main に直接コミットする (フォークには GitHub Releases がないため)。リモートは origin をフォーク、upstream を本家にした。第 1 段階は 5 つのコミットに分け、ほかの未コミットの変更 (Ollama のモデル設定、締め切り、`.gitignore` と `docs/`) も別々のコミットにする。

## 進捗ログ

- 2026-11-02: 分析と計画を作成。
- 2026-11-02: 第 1 段階を TDD で実装し、全体確認まで終えた。
- 2026-11-02: 本家の最新 (v1.3.1) に早送りし、フォークの main にコミットした。Lemonade は `brew install --cask lemonade-server` (公式の .pkg を入れる cask) で入れてもらう。
