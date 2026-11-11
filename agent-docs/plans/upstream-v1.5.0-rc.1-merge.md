# 本家 v1.5.0-rc.1 の取り込み

本家 THU-MAIC/OpenMAIC のリリース候補 v1.5.0-rc.1 を、フォーク takachino/OpenMAIC の main に取り込む。

- 作成: 2026-11-11
- 状態: main に取り込み、フォークの main に push 済み (`58a93349`)。利用者の実機確認待ち。利用者の DB には、この時点で移行 v4 は当たっていない (開発サーバーを起動すると当たる)

## 背景

- フォークの main (05c36892) は、v1.4.2 を取り込んだ後に計画書の 2 コミットを積んでいる。共通の祖先は本家の v1.4.2 (eb7c1bcc)。push 済みなので、rebase はせずマージで取り込む。
- 本家のタグ v1.5.0-rc.1 (07554ab7、2026-11-10 公開) は **プレリリース** で、v1.4.2 から 3 コミット・399 ファイル (+36,360 / -14,731)。タグは本家の main の先頭と同じ (取り込み漏れのコミットはない)。
  - `cee7b7ff` fix(pbl-v3): 試験の修復中に PLAN.md の修正を許す (#2215)
  - `43d6a1b6` feat(workbench): ホーム画面がワークベンチになる (#2094。#2202 と #2206 を含む)
  - `07554ab7` release: v1.5.0-rc.1 (#2224)
- 同時に本家のパッケージのタグ `@openmaic/generation@0.3.32` と `@openmaic/storage@0.39.4` が増えた。
- 399 ファイルの内訳は、ワークベンチ (`components/workbench` 51、`lib/workbench` 40、`tests/workbench` 67)、案内コースの素材 (`public/guide-course` 44。音声の mp3 を含む)、i18n 23、編集画面 (`components/edit` 16) など。

## 本家の変更の要点 (リリースノートより)

- ワークベンチ (`NEXT_PUBLIC_WORKBENCH_ENABLED`。既定はオフ): ホーム画面がワークベンチになる。エージェントランタイム (`OPENMAIC_AGENT_RUNTIME_ENABLED` と `DATABASE_URL`) も要る。オフなら従来のホーム画面のまま。
- ワークベンチを使わなくても全環境に効くもの: 対話ページが教室のペインいっぱいに広がり、はみ出す場合は縮小して収める。コースの終わりの完了ページが、最後のページに重なる閉じのカードになる。ステージ下のドックの高さを変えられ、折りたためる。サーバーが拒んだ保存はエラーで知らされる。`NEXT_PUBLIC_MAIC_EDITOR_ENABLED` だけの環境では、教室の切り替えの表記が Pro から Edit になる。編集画面を再生画面に揃える変更 (台本のカードなど)。
- `@openmaic/generation` 0.3.32 (スライドの `design` の指示)、`@openmaic/storage` 0.39.4 (agent-session の移行 v4)。

### Breaking Changes と、利用者の環境への当たり方

`.env.local` と `openmaic.yml` と開発用 DB を確かめた。

1. **フラグ名の変更** (`NEXT_PUBLIC_PRO_WORKBENCH_ENABLED` → `NEXT_PUBLIC_WORKBENCH_ENABLED`): `.env.local` に新旧どちらもない。影響なし。従来のホーム画面のままで、ワークベンチは使わない。
2. **DB 移行 v4** (`agent_sessions` に `open_question_seq INTEGER` を足し、`agent_session_events` から一度だけ埋める。追加のみ): リリースノートは「エージェントランタイムを有効にしない環境では当たらない」とするが、**利用者の環境では当たるものとして扱う**。
   - 理由: 開発用 DB の `openmaic_schema_migrations` では、`agent-session` の v1〜v3 が v1.4.1 の最初の起動 (2026-11-06 09:23:18) に、`pbl-v3` や `sandbox-environments` と同じ 1 秒の間に当たっている。`OPENMAIC_AGENT_RUNTIME_ENABLED` は未設定なので、フラグなしでも `getAgentSessionStore()` を開く経路がある (`lib/server/pbl-v3/store.ts`、`lib/server/sandbox/service.ts` など)。
  - 実測 (後述の確認結果): 開発用 DB の複製に対して開発サーバーを起動すると、**起動の 1 秒後、最初のリクエストの前に** v4 が当たった。リリースノートの「無効なら当たらない」は、この構成では成り立たない。
  - 当たった後の影響: v1.4.x のサーバーは `SchemaVersionAheadError` で起動しなくなる。戻すときは DB を退避から戻す。
  - 開発用 DB は 30 MB で、`agent_sessions` と `agent_session_events` は 0 行。埋め戻しは空振りで、移行そのものの負荷はない。

そのほか利用者の設定への影響:

- `ALLOW_LOCAL_NETWORKS`、`LLM_THINKING_DISABLED`、Ollama の 3 モデルの扱い: 本家は `lib/ai` に触れていない。影響なし。
- `openmaic.yml` (kokoro の声の設定): 本家は `lib/audio` にも `lib/playback` にも触れていない。影響なし。
- 利用者は `NEXT_PUBLIC_MAIC_EDITOR_ENABLED=true` なので、教室の編集の切り替えの表記が Pro から Edit に変わる。

## 方針

1. タグ v1.5.0-rc.1 をマージする。マージコミットは `chore: merge upstream v1.5.0-rc.1`。
2. 衝突はスクラッチパッドの worktree (ブランチ `merge/upstream-v1.5.0-rc.1`) で解き、型チェック・テスト・ビルドまで済ませてから main を早送りする。
3. **利用者の開発サーバーが、本体の作業ツリーでポート 3000 に動いている** (`next dev`、2026-11-10 12:01 起動)。main を早送りすると、このサーバーが 399 ファイルの変更を拾い、移行 v4 を当てる側に回る。早送りは、利用者が開発サーバーを止めたことを確かめてから行う。それまで本体の作業ツリーには触れない。
4. 実行時の確認 (開発サーバー) は、利用者の開発用 DB の **複製** に対して行う。退避した DB (`pg_dump -Fc`) を同じ Postgres に別名 (`openmaic_verify`) で復元し、worktree の開発サーバー (ポート 3100) の `DATABASE_URL` をそちらにする。利用者の DB には、利用者が新しいコードで起動するまで移行を当てない。
5. DB の退避は、前回 (v1.4.1) と同じく `~/backups/openmaic/` に置く (`pg_dump -Fc` と `data/` の tar)。複製を作る元にもなる。

## 衝突と解き方

`git merge-tree` で確かめた衝突は 1 ファイル (4 箇所)。両側が触ったファイルは 6 つで、残る 5 つは自動でまとまる。

| ファイル | 起きていたこと | 解き方 |
|---|---|---|
| `components/edit/ActionsBar/ActionsBar.tsx` | フォーク: 講座の言語を `regenerateSpeechAudio` が内部で求めるよう、`language` の受け渡しを全部消した。本家: 編集画面の台本を作り直した (このファイルだけで +482 / -366)。衝突は 4 箇所: 台本の 1 行を描く部品の引数と型 (2 箇所、本家は `autoFocus` も消している)、`SpeechTtsBar` の呼び出し、タイムラインの描画 | 本家の版を採り、フォークの「`language` を渡さない」を重ねる。結果と本家のタグの版との差が、フォークが消した `language` の行だけになることで確かめる (`git diff v1.5.0-rc.1 -- <file>`) |

自動でまとまったが、意味の上で確かめるもの:

- `components/edit/PlaybackChromeRoot.tsx`: フォークが `getSpeechLanguage` を足した (v1.4.2 から変わらず)。本家は再生画面の構成を変えた。`new PlaybackEngine(` を作る箇所は 1 か所だけで、`getSpeechLanguage` が残ることを確かめる。
- `lib/server/agent-runtime/generation-tools.ts` と `tests/agent-runtime/generation-tools.test.ts`: フォークが `synthesizeTts` に講座の言語を渡す (`courseSpeechLanguage`)。本家は `generate_scene` に `design` の指示を足した。別の箇所だが、フォークのテスト (「narrates in the course language」) が通ることで確かめる。
- `openmaic.example.yml`: フォークが声の言語のコメントを足した。本家も同じファイルを変えた。コメントが残ることを確かめる。
- `packages/@openmaic/generation/package.json`: 下の「版番号」。

## 版番号

- `@openmaic/generation`: **フォークの 0.3.32 と本家の 0.3.32 が同じ値で、中身は違う** (フォークはアウトラインに講座の言語コードを出させる変更などを足している。本家は `design` の指示を足した)。git は両側が同じ値に変えているので衝突にせず通す。本家のタグ `@openmaic/generation@0.3.32` と区別がつかなくなるので、本家の版の次の 0.3.33 に上げる。
- `@openmaic/storage`: 本家が 0.39.4 に上げた。フォークは変更していないので衝突しない。
- `@openmaic/dsl`: フォークの 0.13.1 のまま。本家は変更していない。
- `@openmaic/renderer`: 本家の 0.2.1 のまま。
- ルートの `package.json`: 本家が 1.5.0-rc.1 に上げた。フォークは変更していない。

## 作業手順

- [x] 1. 計画書を書く (この文書)
- [x] 2. worktree でマージし、`ActionsBar.tsx` の衝突を解く (`55a2214c`)
- [x] 3. 本家のタグの版との差が、フォークの変更だけであることを確かめる (`git diff --numstat` が、フォークが v1.4.2 に対して加えた差と 73 ファイルすべてで一致した)
- [x] 4. 版番号を上げ (generation 0.3.33。マージコミットに含めた)、版番号チェックを流す
- [x] 5. `pnpm install --frozen-lockfile`、型チェック、Prettier と ESLint、i18n と Node の確認、単体テスト全体 (`openmaic.yml` のない worktree)
- [x] 6. 失敗は本家タグ v1.5.0-rc.1 の worktree で同じファイルを流し、失敗したテストの一覧が一致することを確かめた
- [x] 7. PG テストを使い捨てのコンテナで流した (ポート 55439。55432 は別プロジェクトが使うので使わない)
- [x] 8. `pnpm build`
- [x] 9. DB を退避し (`~/backups/openmaic/`)、複製 (`openmaic_verify`) を作り、worktree の開発サーバー (ポート 3100) で確かめた: 移行 v4 の適用、`GET /`、教室と編集画面、取り消し、閉じのカード、`POST /api/generate/tts`。複製は確認後に削除した
- [x] 10. 利用者に確認し (開発サーバーを止めたとの回答)、止まっていること (ポート 3000 に何もなく、本体の作業ツリーを cwd にするプロセスもない) を確かめて、main を早送りした (`58a93349`)。続けて本体の作業ツリーで `pnpm install --frozen-lockfile` を流した (postinstall の `build:packages` でパッケージの `dist` が作り直された。storage の `dist` に移行 v4 のコードが入り、generation の `dist` にフォークの言語コードの変更が入っている。ロックファイルは本家で変わっていないので、依存の取得はない)
- [x] 11. 本体の作業ツリーで `node scripts/check-package-version-bumps.mjs upstream/main` (合格) と `tsc --noEmit` (エラーなし) を流してから、フォークの main に push した (`05c36892..58a93349`)
- [ ] 12. 利用者が実機で確かめ、結果をこの計画書に書き足して push する

## 確認結果

作業ツリー (`merge/upstream-v1.5.0-rc.1` の worktree。`openmaic.yml` も `.env.local` もない。CI と同じ条件) で確かめた。

- フォークの変更の保全: 本家のタグ v1.5.0-rc.1 との差 (`git diff --numstat v1.5.0-rc.1 HEAD`) が、フォークが v1.4.2 に対して加えた差 (`git diff --numstat v1.4.2 05c36892`) と、73 ファイルすべてで追加・削除行数まで一致した。増えたのはこの計画書だけ。`ActionsBar.tsx` は、本家の版との差がフォークの `language` の削除だけ (11 行の追加と 22 行の削除。前回の版と同じ書式)。
- 自動でまとまった 3 ファイルも、フォークの変更が残っている: `PlaybackChromeRoot.tsx` の `getSpeechLanguage` (`new PlaybackEngine(` を作る箇所は 1 か所のまま)、`generation-tools.ts` の `courseSpeechLanguage` (TTS の合成口 `synthesizeSceneNarration` の呼び出しは 2 か所で、どちらも講座の言語を渡す。本家は新しい口を足していない)、`openmaic.example.yml` の声の言語のコメント。
- 型チェック (`tsc --noEmit`): エラー 0 件。
- `pnpm check` (Prettier)、`pnpm check:i18n-keys` (12 ロケール)、`pnpm check:node-engine`: 合格。
- `pnpm lint`: エラー 0 件、警告 19 件。本家タグ v1.5.0-rc.1 でも同じ 19 件 (本家の新規ファイル由来。`ActionsBar.tsx` などフォークが触ったファイルには出ていない)。
- 版番号チェック: `v1.5.0-rc.1` を基準にした場合と `upstream/main` を基準にした場合の両方で合格。generation 0.3.32 → 0.3.33、dsl 0.13.0 → 0.13.1。
- 単体テスト (`vitest run`): 1,246 ファイル中、1,198 が合格、43 がスキップ、5 が失敗 (45 件)。本家タグの worktree で同じ 5 ファイルを流すと、失敗したテストの一覧が完全に一致した (46 項目: 45 件とファイル単位の 1 件)。前回の v1.4.2 と同じ顔ぶれ。
  - IndexedDB のタイムアウト: `tests/utils/course-thumbnail-cache.test.ts`、`tests/runtime/chat-storage.test.ts`、`tests/quiz/runtime.test.ts`。
  - 描画サービスの依存なし: `tests/api/export-video-render-mixed-pool.test.ts`。
  - JDK がない: `tests/pbl/v3/application-command.test.ts`。
- 単体テストのパッケージ: `@openmaic/dsl` 313 件、`@openmaic/geometry` 73 件、`@openmaic/importer` 281 件、`@openmaic/renderer` 189 件、`@openmaic/editor` 629 件が合格。`@openmaic/generation` は 344 件中 342 件が合格し、`interactive-library-mapper` の 2 件が失敗する。本家タグでも同じ 2 件が失敗する (Node 24)。合格数が本家タグより 4 件多いのは、フォークが足した outline-generator のテスト (4 件)。
- PG 契約テスト (CI と同じ環境変数。使い捨ての `postgres:16`、ポート 55439):
  - `@openmaic/storage`: 1,539 件中 1,531 件が合格、7 件がスキップ、`test/http-asset-store.test.ts` の 1 件が失敗 (v1.4.2 と同じ。Node 24。CI は Node 22)。CI の検証スクリプト (`assert-pg-contract-suites.mjs`) は、必要なスイートがすべて実行されて合格し、PG 側の 14 テーブルすべてに挿入があったと確認した。新しい移行 v4 の契約 (「回答すると待機の印が消える」など。`pg-agent-session-store.pg.test.ts` の 72 件を含む。実際の Postgres 16 と PGlite の両方) も、この中で通っている。
  - アプリ側の `*.pg.test.ts` 36 ファイル (CI の定義にある一覧と同じ): 35 ファイルが合格 (708 件)。`tests/pbl/v3/runtime.pg.test.ts` の greeting-java の 2 件が失敗する (このマシンに JDK がないため。v1.4.2 でも同じ 2 件)。本家タグで同じファイルを流すと、同じ 2 件が失敗した (309 件が合格)。
- `pnpm build` (`next build` を含む。利用者の `.env.local` と `openmaic.yml` を置いた状態): 成功。Turbopack の警告は 61 件で、`instrumentation.ts` を経由した Edge ランタイムの警告 (Node の API の利用。`pg` など)。本家タグで同じビルドを流すと、警告の件数も内訳も同じ (このマージが増やした警告はない)。
- 開発サーバー (`pnpm dev --port 3100`。利用者の `.env.local` と `openmaic.yml`。DB は開発用 DB を退避から復元した複製 `openmaic_verify`。利用者のポート 3000 のサーバーには触れず、本物の DB は読み取り (退避と、行数などの問い合わせ) だけで、変更していない):
  - **移行 v4 は、起動の 1 秒後、最初のリクエストの前に当たった** (`agent-session` v4 `open_question_seq`)。ワークベンチのフラグも `OPENMAIC_AGENT_RUNTIME_ENABLED` もない構成で当たった。本物の DB は v3 のままで、複製は確認後に削除した。
  - `GET /` が 200 (従来のホーム画面)。`GET /api/agent/runtime` は `enabled: false`。ログに `[ERROR]` も、既知の ACCESS_CODE 以外の `[WARN]` もない。HTTP の 5xx はない。
  - `POST /api/generate/tts` が 3 回とも 200。Kokoro のログで使われた声: `ja-JP` は `jf_alpha` (言語コード j)、`en-US` は講座の言語の声に替わって `af_heart` (a)、言語なしは `jf_alpha`。v1.4.2 と同じ。
  - 教室と編集画面 (ブラウザ拡張に接続できなかったので、リポジトリの devDependency の Playwright 1.61 と、このマシンの Google Chrome のヘッドレスで、講座の所有者として確かめた。スクリプトは使い捨てで、リポジトリには入れていない。所有者は、`anonymous_id` の Cookie に複製 DB の所有者 ID を載せて再現した):
    - 教室 (Learn): 編集の切り替えは「Edit」(日本語は「編集」)。「Pro」の表記はない。
    - 編集画面: 台本のカードが出る (Claude 講座は 10 枚、Python 講座は 9 枚)。「音声を再生成」で `/api/generate/tts` が 200 を返し、リクエストの `ttsLanguage` は `ja-JP`、声は `jf_alpha`。講座の言語が記録されていない Python 講座でも、本文から導いた `ja-JP` が渡る。再生成した行は「Voiced」に変わる。衝突を解いた `ActionsBar.tsx` の経路 (`regenerateSpeechAudio` が言語を内部で求める) が、新しい画面から通ることの確認。
    - 取り消し・やり直し (v1.4.2 の講座単位の取り消し): 台本の文を編集 → 取り消しで原文に戻る → やり直しで再適用される。最後に取り消して、保存された本文も原文に戻ることを確かめた。
    - 閉じのカード: 対話・クイズ・PBL のページを含む講座を最後まで進めると (7 ページ / 13 ページ)、講座名、「7 pages done」、「Take the quiz」と「Start over」が最後のページに重なって出る (日本語は「13 ページ完了」「小テストへ」「最初から学ぶ」)。
    - コンソールエラー 0 件、失敗した通信 0 件。ページエラーは Python 講座で 1 件: `CodeMirror is not defined`。講座に保存された対話ページ「Python Variable Playground」自身が、`python.min.js` を `codemirror.js` より先に読み込むため。マージとは無関係 (そのあとページは CodeMirror を読み込んで動く)。
    - 所有者でない匿名のブラウザ (閲覧者) では、編集の切り替えが出ず、`GET /api/generation-runs/<id>` が 404 になる (所有者が違うと見えない。所有者の限定と整合する)。
- 未実施: E2E テスト (`pnpm test:e2e`。CI の DB と Web サーバーが要る)。ワークベンチ (`NEXT_PUBLIC_WORKBENCH_ENABLED`) とエージェントランタイム (`OPENMAIC_AGENT_RUNTIME_ENABLED`) の動作確認 (利用者の環境では使わない。本家のテストは単体も PG も通っている)。読み上げの聞き取りと、利用者自身のブラウザでの確認。
- 残した点: フォークの日本語の案内 (`docs/`) は、1.3.0 の記述のままで、v1.4.x の取り込みでも更新していない。本家が廃止した「Pro ワークベンチ」の表記と旧フラグ名 `NEXT_PUBLIC_PRO_WORKBENCH_ENABLED` が残るが、旧名は 1.6.0 まで読まれるので、書かれた手順が動かなくなるものではない。今回は直さない。

## 退避と戻し方

- 退避先 (取り込み前の開発用 DB と `data/`。2026-11-11 に作成):
  - `~/backups/openmaic/openmaic-dev-db-before-v1.5.0-rc.1-2026-11-11.dump` (`pg_dump -Fc`、18 MB、SHA-256 `81dcfc30…c73f7`)。音声などのデータは DB の `asset_blobs` にあるので、これに含まれる。
  - `~/backups/openmaic/openmaic-data-dir-before-v1.5.0-rc.1-2026-11-11.tgz` (リポジトリ直下の `data/`。教材とトークン使用量の記録。3.5 KB、SHA-256 `9af061c0…baf3d`)。
- 退避が戻せることは、同じ Postgres に別名の DB `openmaic_verify` を作って `pg_restore` し、講座 2 件・シーン 20 件・`asset_blobs` 35 件・移行の記録 50 行が元の DB と一致すること (`agent-session` は v3) で確かめた。
- 移行 v4 が当たった DB を、取り込み前の状態に戻す場合 (開発サーバーを止めてから。`dropdb` と `createdb` は、利用者の本物の DB に対してはまだ実行していない):

  ```sh
  git checkout 05c36892 && pnpm install
  docker exec openmaic-dev-db-postgres-1 dropdb -U openmaic --force openmaic
  docker exec openmaic-dev-db-postgres-1 createdb -U openmaic openmaic
  docker exec -i openmaic-dev-db-postgres-1 pg_restore -U openmaic -d openmaic < ~/backups/openmaic/openmaic-dev-db-before-v1.5.0-rc.1-2026-11-11.dump
  ```

## リスクと注意

- データベースの移行は元に戻せない。v1.5.0-rc.1 のコードで開発サーバーを起動すると、起動の 1 秒後に agent-session の移行 v4 が当たる。当てた後は v1.4.x がその DB で起動を拒否する (`SchemaVersionAheadError`)。戻すときは退避から復元する。古い版と新しい版を同じ DB で同時に動かさない。
- 本体の作業ツリーの `@openmaic/*` の `dist` は 2026-11-06 のビルドのままで、storage の移行 v4 のコードを含まない。main を早送りしたら `pnpm install --frozen-lockfile` (postinstall の `build:packages`) で作り直す。v4 を当てるのは storage の `dist` のコードで、本体の `dist/agent-session/pg.js` には `open_question_seq` が 0 件なので、作り直す前に開発サーバーを起動しても v4 は当たらない。ただし新しいアプリのコードと古い `dist` が混ざる。
- 本体の作業ツリーでポート 3000 の開発サーバーが動いている間は、main を動かさない (399 ファイルの変更を拾い、利用者が意図しない時点で移行を当てる側に回る)。
- ワークベンチは使わない構成のまま。使う場合は `NEXT_PUBLIC_WORKBENCH_ENABLED=true` (`NEXT_PUBLIC_*` なのでビルドに埋め込まれる)、`OPENMAIC_AGENT_RUNTIME_ENABLED=true`、`agent` スロットのモデルが要る。このマージでは確かめていない。

## 戻し方

- main を動かす前: `merge/upstream-v1.5.0-rc.1` を捨てる。main は 05c36892 のまま。DB も変わっていない (確認は複製に対してだけ)。
- main を動かした後、push の前: main を 05c36892 に戻す。
- push の後: マージコミットを `git revert -m 1 <マージコミット>` で打ち消してから push する。
- **利用者の DB に移行 v4 が当たった後**: コードを戻しても v1.4.x は起動しない。上の「退避と戻し方」の手順で、`~/backups/openmaic/` の退避から戻す。

## 進捗ログ

- 2026-11-11: 本家 v1.5.0-rc.1 を調べた。衝突は 1 ファイル (4 箇所)。利用者の環境にはワークベンチのフラグも、エージェントランタイムのフラグもないが、DB 移行 v4 は当たるものとして扱うことにした。利用者の開発サーバーがポート 3000 で動いているのを見つけ、main を動かすのを利用者の確認の後にした。計画書を書いて作業を始めた。
- 2026-11-11: worktree でマージし (`55a2214c`)、`ActionsBar.tsx` の衝突を解いた。generation は両側が 0.3.32 で衝突にならなかったので、0.3.33 に上げた。型チェック、lint、単体テスト、PG テスト、ビルドを流し、新しく壊れたものがないことを本家タグと比べて確かめた。
- 2026-11-11: 開発用 DB を退避し、複製に対して開発サーバーを起動した。移行 v4 が、フラグなしで起動の 1 秒後に当たることを確かめた (リリースノートの記述と食い違う)。ブラウザ拡張に接続できなかったので、Playwright で教室・編集画面・取り消し・閉じのカードを確かめた。複製は削除した。
- 2026-11-11: 利用者の開発サーバー (ポート 3000) が本体の作業ツリーで動いているため、main の早送りと `pnpm install` は、利用者の確認を待つことにした。
- 2026-11-11: 利用者が開発サーバーを止めたと回答した。止まっていることを確かめて main を早送りし、`pnpm install --frozen-lockfile`、版番号チェック、型チェックを流して、フォークの main に push した (`58a93349`)。利用者の DB は v3 のまま (開発サーバーは起動していない)。worktree とブランチは片付けた。
