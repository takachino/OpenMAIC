# 本家 v1.4.0・v1.4.1 の取り込み

本家 THU-MAIC/OpenMAIC のリリース v1.4.0 と v1.4.1 を、フォーク takachino/OpenMAIC の main に取り込む。

- 作成: 2026-11-06
- 状態: main に取り込み、開発サーバーでの確認まで終えた (フォークの main に push)。日本語の講座の読み上げは利用者が耳で確かめる

## 背景

- フォークの main は v1.3.1 (c94aeac4) の上に、講座の読み上げ言語の対応など 14 コミットを積んでいる (a1eae6b5)。push 済みなので、rebase はせずマージで取り込む。
- 本家の差分は v1.3.1 → v1.4.1 で 36 コミット・687 ファイル (うち新規 384)。大半は PBL v3 と共有サンドボックス。
- 本家の main には v1.4.1 の後に未リリースのコミットが 3 件ある (#2188、#2190、#2191)。今回はリリースのタグ v1.4.1 までにとどめる。

## 方針

1. タグ v1.4.1 をマージする (v1.4.0 を含む)。マージコミットは `chore: merge upstream v1.4.1`。
2. 衝突はスクラッチパッドの worktree で解き、そこで型チェックとテストまで済ませる。main は確認済みのマージコミットまで早送りする。
3. データベースの移行は元に戻せないので、新しい版を起動する前に開発用 DB を退避する。

## 衝突と解き方

両側が変更したファイルは 22 個。git が自動でまとめられなかったのは次の 4 個。

| ファイル | 起きていたこと | 解き方 |
|---|---|---|
| `lib/server/agent-runtime/scene-tts.ts` | 本家が TTS の利用可否の判定を `hasConfiguredTtsCapability` に切り出して `activeConnection` を導入し、モデルの解決と認可を行ごとの処理の中 (保存済みの声の互換チェックの後) へ移した | 本家の構造に合わせ、`chosenVoice` → `courseLanguageVoice` の声の置き換え、`language` の受け渡し、`narrationVoiceReport` を残す。`connection.voices` は `activeConnection.voices` にする (判定が関数になり、`connection` の型が絞られないため) |
| `lib/import/use-import-classroom.ts` | 両側が import を 1 行ずつ追加 (`normalizeLanguageCode` と `installClassroomProjects`) | 両方残す |
| `tests/server/generation-runs.pg.test.ts` | 両側が同じ位置にテストを追加 (講座の言語での読み上げと、ナレーションの再試行) | 両方残す |
| `packages/@openmaic/dsl/package.json` | 版番号がフォーク 0.12.1、本家 0.13.0 | 0.13.1 |

git が衝突にしないが、直す必要がある点:

- `@openmaic/generation` は両側が別々の変更で 0.3.28 → 0.3.29 に上げていた。同じ版番号で中身が違うことになるので 0.3.30 にする。

自動でまとまったファイルのうち、意味の上でかみ合うかを読んで確かめたもの:

- 音声プロバイダー (`lib/audio/tts-providers.ts` ほか): Qwen の声のクローンは CosyVoice の別経路になり、言語は渡らない (取り込み前も渡していない)。新しい Xiaomi MiMo TTS は言語を受け取らず、声で言語が決まるプロバイダー (`voiceSetsLanguage`) にもしていない。
- 再生: 本家の #2110 は音声の再生に失敗したときの処理 (`lib/utils/audio-player.ts`) で、フォークの変更は音声のない行の処理 (`lib/playback/engine.ts`)。別の分岐なので干渉しない。
- エクスポート / インポート、生成のラン、エージェントのツール: フォークの変更がそのまま本家のコードの上に乗る。

## 作業手順

- [x] 1. 捨て用の worktree でマージし、衝突を解いてコミットする (2140ae48)
- [x] 2. 捨て用の worktree で確認する (結果は下記)
- [x] 3. 開発用 DB (`openmaic-dev-db-postgres-1`) を `pg_dump` で退避する (下記の「退避と戻し方」)
- [x] 4. main を 2140ae48 まで早送りする
- [x] 5. 本体で `pnpm install` し、型チェック、テスト、版番号チェックを流す
- [x] 6. 開発サーバーを起動して、DB の移行が通ることと、TTS が Kokoro の講座の言語の声で返ることを確かめる (壊れたものを push しないよう、push の前に行った)
- [x] 7. この計画書をコミットし、フォークの main に push する
- [ ] 8. 利用者が講座を開き、日本語の講座が日本語のまま読まれることを耳で確かめる

## 確認結果

捨て用の worktree (`openmaic.yml` も `.env.local` もない状態) で確かめた。

- 型チェック (`tsc --noEmit`): エラー 0 件。
- Prettier と ESLint: 手を入れた 5 ファイルで問題なし。
- `check-package-version-bumps.mjs upstream/main`: 合格 (dsl 0.13.0 → 0.13.1、generation 0.3.29 → 0.3.30)。
- 単体テスト全体: 1,159 ファイルが合格し、5 ファイルが失敗した。
  - `tests/workflows/app-pg-contract.test.ts` は、衝突を解く前の index (未マージのファイルが 3 回数えられる) で流したための失敗で、コミット後は合格する。
  - 残る 4 ファイル 45 件 (`tests/runtime/chat-storage`、`tests/quiz/runtime`、`tests/utils/course-thumbnail-cache`、`tests/api/export-video-render-mixed-pool`) は、本家 v1.4.1 そのままでもまったく同じものが失敗する。
- パッケージ: dsl は 313 件すべて合格。generation は `interactive-library-mapper.test.ts` の 2 件が失敗するが、本家 v1.4.1 でも同じ (Node 24 で失敗する既知のもの)。
- PG テスト (使い捨てのコンテナで 36 ファイル): 35 ファイルが合格。`generation-runs.pg.test.ts` は両側のテストを含む 80 件すべて合格。`tests/pbl/v3/runtime.pg.test.ts` の greeting-java の 2 件は Java がないため失敗し、本家 v1.4.1 でも同じ。
- 未実施: `next build`、E2E テスト。

本体 (main を早送りした後) で確かめた。

- `pnpm install --frozen-lockfile`: 成功。追跡中のファイルは書き換わらない。
- 型チェック: エラー 0 件。版番号チェック: 合格。
- 単体テスト全体: 17 ファイル 97 件が失敗する。うち 4 ファイル 44 件は上記と同じもの (本家 v1.4.1 でも失敗)。残る 13 ファイル 53 件は、リポジトリ直下の `openmaic.yml` (TTS が Kokoro など) を読むせいで失敗する。
  - 確かめ方: 捨て用の worktree (同じコミット、`openmaic.yml` なし) では合格し、`OPENMAIC_CONFIG` で同じ `openmaic.yml` を読ませると 52 件が同じように失敗した。残る 1 件 (`tests/server/model-authorization-transport.test.ts`) は、テスト自身が `OPENMAIC_CONFIG` を空にするので、作業ディレクトリ直下の `openmaic.yml` を読んだときだけ失敗する。
  - 取り込み前 (a1eae6b5) は、この環境で失敗するのは 2 ファイル 7 件だった。本家の新しいテストが `openmaic.yml` のない環境を前提にしているため増えた。CI 相当の確認は、引き続き worktree で行う。

開発サーバー (`pnpm dev --port 3100`。ポート 3000 は別のプロジェクトが使っていた) で確かめた。

- 起動時に DB の移行が当たった: asset v4 (`retained-document-assets`) のほか、`pbl-projects`、`pbl-v3` (11 件)、`sandbox-environments` (11 件)、`agent-session` (3 件) の表が作られた。PBL v3 とサンドボックスは設定しない限り使われない。
- トップページと講座 (「Python入門」) のページが 200 で開き、サーバーのログにエラーはない。
- `POST /api/generate/tts` を Kokoro-FastAPI のログで確かめた: `ttsLanguage: ja-JP` は `jf_alpha`、`en-US` は `af_heart` (講座の言語の声への置き換え)、言語なしは `jf_alpha`。取り込み前と同じ。
- 確認の後、開発サーバーは止めた。

## 退避と戻し方

- 退避先: `~/backups/openmaic/openmaic-dev-db-before-v1.4.1-2026-11-06.dump` (`pg_dump -Fc`、2.6 MB、SHA-256 `e69f49fb…96b0b`)。音声などのデータは DB の `asset_blobs` にあるので、これに含まれる。リポジトリ直下の `data/` (教材とトークン使用量の記録) も `~/backups/openmaic/openmaic-data-dir-before-v1.4.1-2026-11-06.tgz` に退避した。
- 退避が戻せることは、使い捨てのコンテナに `pg_restore` して確かめた。講座 1 件・シーン 13 件・`asset_blobs` 6 件が今の DB と一致し、移行の記録は asset v3 (23 行) の状態だった。
- 取り込み前の版に戻す場合 (開発サーバーを止めてから。空の DB に `pg_restore` で戻せることは確かめたが、`dropdb` と `createdb` はまだ実行していない):

  ```sh
  git checkout a1eae6b5 && pnpm install
  docker exec openmaic-dev-db-postgres-1 dropdb -U openmaic --force openmaic
  docker exec openmaic-dev-db-postgres-1 createdb -U openmaic openmaic
  docker exec -i openmaic-dev-db-postgres-1 pg_restore -U openmaic -d openmaic < ~/backups/openmaic/openmaic-dev-db-before-v1.4.1-2026-11-06.dump
  ```

## リスクと注意

- データベースの移行は元に戻せない。v1.4 系は、起動後の最初のリクエスト (遅くとも約 30 秒後) で asset の移行 v4 (`retained`) を当てる。当てた後は v1.3.x がその DB で起動を拒否する (`SchemaVersionAheadError`)。戻すときは退避したものから復元する。古い版と新しい版を同じ DB で同時に動かさない。
- 依存が増えた (e2b、monaco-editor、xterm、pi-agent 0.80.3 など) ので `pnpm install` が要る。
- 影響しないもの: Qwen の声のクローンの変更 (TTS は Kokoro で、`TTS_QWEN_MODELS` は空)。PBL v3 と共有サンドボックスは、`openmaic.yml` に `sandbox` を設定しない限りオフ。
- 次に本家を取り込むとき: 本家の main の #2190 (カタログにないモデルへの思考の切り替えの送り方、`lib/ai/providers.ts`) は、フォークの 461fa3f0 (Ollama のモデルで思考をオフにする、`lib/ai/model-metadata.ts`) と関係する。ファイルは別だが、意味の上で重ならないかを確かめる。

## 進捗ログ

- 2026-11-06: 本家の v1.4.0・v1.4.1 を調べ、捨て用の worktree でマージと確認を終えた。利用者の了承を得て、main への反映を始めた。
- 2026-11-06: 開発用 DB を退避し、main を早送りした。本体と開発サーバーで確認し、フォークの main に push した。
