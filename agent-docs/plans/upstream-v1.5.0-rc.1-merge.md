# 本家 v1.5.0-rc.1 の取り込み

本家 THU-MAIC/OpenMAIC のリリース候補 v1.5.0-rc.1 を、フォーク takachino/OpenMAIC の main に取り込む。

- 作成: 2026-11-11
- 状態: 作業中 (worktree でマージ・確認の途中。main はまだ動かしていない)

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
- [ ] 2. worktree でマージし、`ActionsBar.tsx` の衝突を解く
- [ ] 3. 本家のタグの版との差が、フォークの変更だけであることを確かめる (`git diff v1.5.0-rc.1 HEAD --stat` が、フォークが v1.4.2 から変えたファイルと一致する)
- [ ] 4. 版番号を上げ (generation 0.3.33)、版番号チェックを流す
- [ ] 5. `pnpm install --frozen-lockfile`、型チェック、Prettier と ESLint、i18n と Node の確認、単体テスト全体 (`openmaic.yml` のない worktree)
- [ ] 6. 失敗は本家タグ v1.5.0-rc.1 の worktree で同じファイルを流し、失敗したテストの一覧が一致することを確かめる
- [ ] 7. PG テストを使い捨てのコンテナで流す (ポート 55432 は別プロジェクトが使うので使わない)
- [ ] 8. `pnpm build`
- [ ] 9. DB を退避し (`~/backups/openmaic/`)、複製 (`openmaic_verify`) を作り、worktree の開発サーバー (ポート 3100) で確かめる: 移行 v4 の適用、`GET /`、教室と編集画面、`POST /api/generate/tts`
- [ ] 10. 利用者の確認を取り、開発サーバーが止まっていることを確かめて、main を早送りする
- [ ] 11. この計画書の確認結果を書き、コミットして push する
- [ ] 12. 利用者が実機で確かめる

## 確認結果

(作業が進んだら書く)

## 戻し方

- main を動かす前: `merge/upstream-v1.5.0-rc.1` を捨てる。main は 05c36892 のまま。DB も変わっていない (確認は複製に対してだけ)。
- main を動かした後、push の前: main を 05c36892 に戻す。
- push の後: マージコミットを `git revert -m 1 <マージコミット>` で打ち消してから push する。
- **利用者の DB に移行 v4 が当たった後**: コードを戻しても v1.4.x は起動しない。`~/backups/openmaic/` の退避を `pg_restore --clean` で戻す (戻し方の詳細は `upstream-v1.4.1-merge.md`)。

## 進捗ログ

- 2026-11-11: 本家 v1.5.0-rc.1 を調べた。衝突は 1 ファイル (4 箇所)。利用者の環境にはワークベンチのフラグも、エージェントランタイムのフラグもないが、DB 移行 v4 は当たるものとして扱うことにした。利用者の開発サーバーがポート 3000 で動いているのを見つけ、main を動かすのを利用者の確認の後にした。計画書を書いて作業を始めた。
