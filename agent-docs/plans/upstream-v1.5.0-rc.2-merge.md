# Upstream v1.5.0-rc.2 の取り込み

## 目的と範囲

- 本家 `THU-MAIC/OpenMAIC` のタグ `v1.5.0-rc.2` (`a2aeffce`) をフォークにマージする。タグより後のコミットは取り込まない。
- 開始時点の main は `02a53adf`。作業ツリーに変更なし。origin/main と一致している。
- rc.1 以降は 14 コミット、132 ファイル。主な変更はワークベンチ、Native 教室の白板コンテキスト、PBL のプレビュー・評価・履歴。
- 本家の rc.1 と rc.2 の間に `packages/` とロックファイルの変更はなく、DB の移行も増えていない。ルートの版番号だけが rc.2 に上がる。
- origin には Release タグがないため、利用者の規約に従い、検証後に main に統合して push する。
- OpenMAIC の開発サーバーは検出されなかった。検出した `pnpm dev` は別リポジトリのプロセス。

## 統合方針

- ローカルの作業ブランチで `git merge --no-ff --no-commit v1.5.0-rc.2` を行う。フォーク独自差分の保全を確認してマージコミットを作成し、設定ファイルのない検証用 worktree で検証してから main に統合する。
- 本家とフォークの両方が変更したファイルは `components/edit/PlaybackChromeRoot.tsx`。本家の生成中の講座の判定と、フォークの講座言語を読み上げに渡す変更を両方残す。
- フォーク独自の音声言語対応、Kokoro、生成・インポート・エクスポートの言語情報を維持する。本家タグとの差を取り込み前の差と比較して確認する。
- 新しい実装が必要になった場合は、先に回帰テストを追加して失敗を確認する。上流の変更には上流の追加・変更テストを用いる。
- 開発用 DB に接続するサーバーは起動しない。実 DB が必要なテストには専用の使い捨て DB を使う。

## 手順

- [x] タグ・リリース内容、履歴、ローカル差分、動作中のサーバー、既存の検証手順を確認する。
- [x] 計画書を作成する。
- [x] 作業ブランチでマージし、競合があれば解消する (競合なし)。
- [x] 本家タグとの差からフォーク独自変更が保たれたことを確認する。
- [x] 依存・パッケージビルド、版番号、書式、lint、型、i18n、Node 契約を確認する。
- [x] 変更領域と音声対応のテスト、必要な単体・DB テスト、アプリビルドを実行する。失敗は本家タグまたは取り込み前と比較する。
- [x] Conventional Commits 形式でマージコミットを作成する (`a147a677`)。
- [x] 最終的な検証結果を記録する。
- [ ] main に統合して origin/main に push し、作業ツリーと履歴を確認する。

## 検証結果

- `git diff --numstat v1.5.0-rc.1 HEAD` (取り込み前) と `git diff --numstat v1.5.0-rc.2` (マージ後) は全 73 ファイルで完全一致した。計画書はこの比較時点では未追跡。
- `PlaybackChromeRoot.tsx` の本家タグとの差は、`courseSpeechLanguage` の import と `getSpeechLanguage` の設定だけ。競合も追加の実装修正もない。
- 設定なしで検証するため、マージコミットを作業ブランチに作成してから、検証専用の worktree を作る。main への統合と push は検証後。
- `pnpm install --frozen-lockfile`: 本体と検証用 worktree の両方で成功。全ローカルパッケージの再ビルドも成功し、追跡ファイルの書き換えはない。検証用 worktree に `render-service` の依存も `npm ci` で準備した。
- `pnpm check`、`pnpm lint`、`tsc --noEmit`、i18n (12 ロケール)、Node 要件、内部依存の版範囲、開始時点の main を基準としたパッケージ版番号チェックは成功。lint はエラー 0 件、前回と同じ警告 19 件。
- `pnpm build`: 成功。検証用 worktree と使い捨て DB の組み合わせで実行した。Turbopack の警告は 60 件 (Edge ランタイムとファイル追跡に関する警告)。
- PBL のブラウザテスト: 変更された `e2e/tests/pbl-v3-onboarding.spec.ts` と `e2e/tests/pbl-v3-conversation.spec.ts` の全 66 件が Chromium で成功 (1.8 分)。本番ビルド、ポート 3002、使い捨て PostgreSQL を使用。
- 単体テストの初回は `pnpm exec` が Node 26.13.1 を選び、`localStorage` の環境差による失敗が多数あった。シェルの `node` は 24.22.3 でも `pnpm exec node --version` は 26.13.1 になるため、既存の Node 24 の絶対パスで全体を再実行した。リポジトリや端末のランタイム設定は変更していない。
- 単体テスト全体 (Node 24.22.3): 1,257 ファイル、16,559 件中 15,748 件成功、766 件スキップ、45 件失敗。失敗した次の 4 ファイルを本家タグの別 worktree でも同じ Node 24 で実行し、失敗した 45 件のテスト名の集合が完全一致することを確認した。マージ側だけの失敗はない。
  - IndexedDB: `tests/quiz/runtime.test.ts` (4 件)、`tests/runtime/chat-storage.test.ts` (37 件)、`tests/utils/course-thumbnail-cache.test.ts` (3 件)。タイムアウトと保存回数の不一致。
  - Java: `tests/pbl/v3/application-command.test.ts` (1 件)。この環境に JDK がない。
- フォーク独自のパッケージテスト (Node 24): DSL の `test/language-code.test.ts` は 22 件、generation の `test/outline-generator.test.ts` と `test/outline-prompt.test.ts` は計 22 件、すべて成功。
- 変更された PG テスト (`owner-claims.pg.test.ts` と `runtime.pg.test.ts`): 334 件中 332 件成功。Java 関連の 2 件が失敗した。本家タグの `runtime.pg.test.ts` も同じ 2 件が失敗し、失敗したテスト名の集合が完全一致した。コンテナ `openmaic-rc2-check` (ポート 55439) を使用し、既存の開発用 DB には接続していない。
- 未実施: E2E 全体、変更のないパッケージの全テスト、全 PG 契約テスト、Docker イメージのビルド、実モデルへの生成リクエスト、音声の聞き取り。今回のコード修正は上流の取り込みだけで、独自の競合解消・追加修正はない。

## 戻し方

- マージコミットは `a147a677`、第一親は開始時点の `02a53adf`。統合後にコードを戻す場合は `git revert -m 1 a147a677` を使う。
- この取り込みによる新しい DB 移行はない。検証は専用コンテナだけで行い、利用者の DB は変更していない。
