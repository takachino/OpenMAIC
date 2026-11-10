# 本家 v1.4.2 の取り込み

本家 THU-MAIC/OpenMAIC のリリース v1.4.2 を、フォーク takachino/OpenMAIC の main に取り込む。

- 作成: 2026-11-10
- 状態: 確認済み。main に取り込み済み (`c4df421b`)。push は計画書のコミットと合わせて行う。利用者の実機確認 (取り消しと読み上げ) は未了

## 背景

- フォークの main (5b6e874e) は、v1.4.1 を取り込んだ後に 17 コミットを積んでいる。共通の祖先は本家の v1.4.1 (5c3531ce)。push 済みなので、rebase はせずマージで取り込む。
- 本家のタグ v1.4.2 (eb7c1bcc、2026-11-09 公開) は v1.4.1 から 19 コミット・180 ファイル (+8234 / -1829)。主な内容は講座単位の取り消しとやり直し (#2159) と、PBL v3・生成・サンドボックスの修正。
- 本家の main にはタグの後に 1 件 (cee7b7ff、#2215) の未リリースのコミットがある。v1.4.1 のときと同じく、今回もタグ v1.4.2 までにとどめる。
- スキーマと移行の変更はない (リリースノートの記述)。

## 方針

1. タグ v1.4.2 をマージする。マージコミットは `chore: merge upstream v1.4.2`。
2. 衝突はスクラッチパッドの worktree (ブランチ `merge/upstream-v1.4.2`) で解き、型チェックとテストまで済ませてから main を早送りする。
3. 開発用 DB は退避しない。スキーマと移行に変更がなく、移行 v4 は v1.4.1 で適用済みのため、マージでデータが変わることはない。

## 衝突と解き方

`git merge-tree` で確かめた衝突は 4 ファイル。

| ファイル | 起きていたこと | 解き方 |
|---|---|---|
| `components/edit/ActionsBar/ActionsBar.tsx` | フォーク: 講座の言語を `regenerateSpeechAudio` が内部で求めるよう、`language` の受け渡しを消した。本家 (#2159): 編集を `commitCourseEdit` と `stampGeneratedAudio` に替え、`discardSpeechAudio` の呼び出しを消した | 本家の変更を残し、フォークの「`language` を渡さない」を重ねる (`language` の変数・prop・依存配列も消す) |
| `lib/audio/regenerate-speech-tts.ts` | フォーク: 言語の引数を消し、`courseSpeechLanguage` で求める。本家: `discardSpeechAudio` を消した | 両方残す。`discardSpeechAudio` は消えたままにし、使われなくなった import を消す |
| `lib/server/agent-runtime/scene-tts.ts` | フォーク: 講座の言語の声 (`courseLanguageVoice`)、`language` の受け渡し、`narrationVoiceReport`。本家 (#2197): VoxCPM の自動の声に話者情報 (`narratorSpeaker`) を渡す | 両方残す。import に `TTSSpeaker` を加え、`speaker` を TTS の呼び出しに渡す |
| `packages/@openmaic/generation/package.json` | フォーク 0.3.30、本家 0.3.31 (#2210) | 0.3.32 (本家の版の次) |

自動でまとまったが、意味の上で確かめたもの:

- 思考の切り替え (本家 #2190 `lib/ai/providers.ts` と、フォーク 461fa3f0 `lib/ai/model-metadata.ts`): 前回の計画書で「重ならないかを確かめる」とした件。フォークは gemma4:26b、gemma4:12b、qwen3.5:9b をカタログに登録している (`ollamaEffort`)。#2190 の新しい経路は「カタログにないモデル」(`getCatalogThinkingCapability` が undefined を返すとき) にだけ入るので、この 3 モデルには効かない。結論: 重ならない。
- 音声 (`lib/audio/tts-providers.ts`、`lib/audio/types.ts`): 自動でまとまった。`TTSSpeaker` の追加 (本家) と、声の言語 (フォーク) は別の箇所にある。型チェックで確かめる。
- `.gitignore`: 両側が末尾に 1 ブロックずつ足している。両方残る。

## 版番号

- `@openmaic/generation`: フォーク 0.3.30、本家 0.3.31。本家の版の次の 0.3.32 にする。
- `@openmaic/renderer`: 本家が 0.2.1 に上げた。フォークは変更していないので衝突しない。
- `@openmaic/dsl`: フォークの 0.13.1 のまま。本家は v1.4.2 で変更していない。
- ルートの `package.json`: 本家が 1.4.2 に上げた。フォークは変更していない。

## 利用者の設定への影響

`.env.local` と、ローカルの Ollama (`ollama list`) を確かめた。

- `ALLOW_LOCAL_NETWORKS=true` は設定済み。v1.4.2 では `198.18.0.0/15` (TUN・fake-ip 型のプロキシが使う範囲) も、運用者が設定したエンドポイントに対して許可される。利用者はすでに許可しているので、範囲が広がるだけ。
- `ASSET_COLLECTION_GRACE_MS` は未設定 (既定の 1 時間)。影響なし。
- サンドボックスは `openmaic.yml` と `.env.local` のどちらにも設定がない。影響なし。
- Ollama にあるモデルは gemma4:26b、gemma4:12b、qwen3.5:9b の 3 つだけで、すべてカタログに登録済み。影響なし。

## 作業手順

- [x] 1. 計画書を書く (この文書)
- [x] 2. worktree でマージし、4 ファイルの衝突を解く (`c4df421b`)
- [x] 3. 版番号を上げ (generation 0.3.32)、版番号チェックを流す (`v1.4.2` と `upstream/main` の両方で合格)
- [x] 4. `pnpm install --frozen-lockfile`、型チェック、Prettier と ESLint、単体テスト全体 (`openmaic.yml` のない worktree)
- [x] 5. 失敗は本家タグ v1.4.2 の worktree で同じファイルを流し、失敗したテストの一覧が一致することを確かめた
- [x] 6. PG テストを使い捨てのコンテナで流した (`postgres:16`、ポート 55439。55432 は別プロジェクトが使うので使わない)
- [x] 7. main を `c4df421b` まで早送りした
- [x] 8. 開発サーバーで TTS の声を確かめた。この計画書の確認結果を書き、コミットして push する
- [ ] 9. 利用者が講座の取り消し (Cmd/Ctrl+Z) と読み上げを実機で確かめる

## 確認結果

作業ツリー (`merge/upstream-v1.4.2` の worktree。`openmaic.yml` も `.env.local` もない。CI と同じ条件) で確かめた。

- 型チェック (`tsc --noEmit`): エラー 0 件。
- `pnpm check` (Prettier): 合格。`pnpm check:i18n-keys`、`pnpm check:node-engine`: 合格。
- `pnpm lint`: エラー 0 件、警告 16 件。本家タグ v1.4.2 でも同じ 16 件 (変更していないファイル由来)。
- 版番号チェック: `v1.4.2` を基準にした場合と `upstream/main` を基準にした場合の両方で合格。generation 0.3.31 → 0.3.32、dsl 0.13.0 → 0.13.1。
- 単体テスト (`pnpm test`): 1,216 ファイル中、1,168 が合格、43 がスキップ、5 が失敗 (45 件)。本家タグ v1.4.2 の worktree で同じ 5 ファイルを流すと、失敗したテストの一覧が完全に一致した。
  - IndexedDB のタイムアウト (前回と同じ): `tests/utils/course-thumbnail-cache.test.ts`、`tests/runtime/chat-storage.test.ts`、`tests/quiz/runtime.test.ts`。
  - 描画サービスの依存なし (前回と同じ): `tests/api/export-video-render-mixed-pool.test.ts`。
  - JDK がない (新規。v1.4.2 で追加された Java アプリのプレビューのテスト): `tests/pbl/v3/application-command.test.ts`。
- 単体テストのパッケージ: `@openmaic/dsl` 313 件、`@openmaic/renderer` 189 件が合格。`@openmaic/generation` は 339 件が合格、`interactive-library-mapper` の 2 件が失敗し、本家タグでも同じ (Node 24)。
- PG 契約テスト (CI と同じ環境変数):
  - アプリ側の `*.pg.test.ts` 36 ファイル: 35 ファイルが合格 (707 件)。`tests/pbl/v3/runtime.pg.test.ts` の greeting-java の 2 件は JDK がないため失敗し、本家タグでも同じ。
  - `@openmaic/storage` の PG 契約: 1,520 件が合格、`test/http-asset-store.test.ts` の 1 件が失敗。storage はこのマージで変わっておらず、本家タグでも同じ失敗になる。CI は Node 22 で、ここは Node 24.22.2 (Node 22 は入っていないので、Node 22 では確かめていない)。
- `pnpm build` (`next build` を含む): 成功。Turbopack の警告 60 件は、すべて `@openmaic/storage/dist/server/reference.js` の Edge ランタイムの警告 (このマージで変えていない)。
- 開発サーバー (`pnpm dev --port 3100`。利用者の `openmaic.yml` と `.env.local`、開発用 DB。移行は当たらなかった):
  - `GET /` が 200、`POST /api/generate/tts` が 3 回とも 200。ランタイムのエラーは出ていない。ログには、ビルドと同じ Edge ランタイムの警告が出ている。
  - Kokoro のログで使われた声: `ja-JP` は `jf_alpha` (言語コード j)、`en-US` は講座の言語の声に替わって `af_heart` (a)、言語なしは `jf_alpha`。前回の確認と同じ。
- 未実施: E2E テスト (`pnpm test:e2e`)。取り消し (Cmd/Ctrl+Z) と読み上げの UI での確認は、利用者の実機確認に残す。

## 戻し方

- push の前: `merge/upstream-v1.4.2` を捨てる。main は 5b6e874e のまま。
- push の後: マージコミットを `git revert -m 1 <マージコミット>` で打ち消してから push する。DB は変わらないので戻す必要はない。

## 進捗ログ

- 2026-11-10: 本家 v1.4.2 を調べ、衝突 4 ファイルを特定した。#2190 と Ollama の件は重ならないと読めたので、計画書を書いて作業を始めた。
- 2026-11-10: worktree でマージし (`c4df421b`)、4 ファイルの衝突を解いた。型チェック、lint、単体テスト、PG テスト、ビルドを流し、新しく壊れたものが無いことを本家タグと比べて確かめた。
- 2026-11-10: 開発サーバーで TTS の声を確かめてから、main を `c4df421b` まで早送りした。
