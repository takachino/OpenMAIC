# 開発と拡張

> 生成: OpenCode + DeepSeek V4.1 Flash Free（2026-11-02）

## 開発環境の準備

```bash
pnpm install
cp .env.example .env.local
cp openmaic.example.yml openmaic.yml
pnpm db:up
pnpm dev
```

`pnpm install` の `postinstall` は、`packages/` 配下のワークスペースパッケージを依存順にビルドし、インポーターとインタラクティブ資産を同期します。
パッケージのソースを変更した場合、アプリから使う前に再ビルドが必要です。

```bash
pnpm build:packages
```

## リポジトリの読み方

初めてコードを追う場合は、次の順序が理解しやすいです。

1. `packages/@openmaic/dsl/src/` でコースのデータ構造を把握する。
   `stage.ts` に `Stage`、`Scene`、`SceneType`、`action.ts` にアクションの型がある。
2. `packages/@openmaic/generation/src/` で生成の契約とプロンプトを読む。
3. `lib/server/generation/` でサーバー側の生成実行を追う。
4. `lib/playback/engine.ts` と `lib/action/engine.ts` で再生の流れを追う。
5. `lib/chat/pi/director-loop.ts` で教室のターン制御を追う。
6. `packages/@openmaic/storage/src/` で保存先の抽象を確認する。
7. `app/api/` で HTTP の入口を確認する。

UI は `components/`、状態管理は `lib/store/`、国際化は `lib/i18n/` にあります。

## 主なコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバーを起動する |
| `pnpm build` | 本番ビルドを作る |
| `pnpm start` | 本番ビルドを起動する |
| `pnpm lint` | ESLint を実行する |
| `pnpm check` | Prettier の整形チェック |
| `pnpm format` | Prettier で整形する |
| `pnpm test` | Vitest のユニットテスト |
| `pnpm test:e2e` | Playwright の E2E テスト。`DATABASE_URL` が必要 |
| `pnpm test:e2e:ui` | Playwright を UI モードで実行する |
| `pnpm db:up` / `pnpm db:down` | 開発用 PostgreSQL の起動と停止 |
| `pnpm check:i18n-keys` | 翻訳キーの整合性を確認する |
| `pnpm check:node-engine` | Node.js のバージョン契約を確認する |
| `pnpm check:package-versions` | 公開パッケージのバージョン更新を確認する |
| `pnpm build:standalone-player` | オフライン HTML 用プレイヤーをビルドする |

### 評価スクリプト

`eval/` には、生成品質を測るためのスクリプトがあります。
いずれも実際のモデルを呼ぶため、API の利用枠を消費します。

```bash
pnpm eval:pbl-v2-planner
pnpm eval:whiteboard
pnpm eval:outline-language
pnpm eval:orchestration:answering
pnpm eval:orchestration:answer-content
```

## 拡張の入口

### モデルプロバイダーを追加する

1. `lib/config/provider-presets.ts` にプリセットを追加する。
2. 必要なら `lib/server/model-config/` の解決処理に対応を入れる。
3. `openmaic.example.yml` と公式ドキュメントの `supported-models.mdx` を更新する。
4. 認証情報は環境変数で受け取り、コードに埋め込まない。

共有層に特定ベンダーの分岐を足さないでください。
ベンダー固有の処理は、そのプロバイダーのモジュールに閉じ込めます。

### TTS や ASR を追加する

音声関連は `lib/audio/` にプロバイダー実装があります。
TTS は音声のストリーミング、声の一覧、クローン登録の有無を扱います。
ASR は音声形式の制約（WAV のみか、など）に注意します。

追加したプロバイダーは、スロット `tts` または `asr` から解決できるようにします。
デプロイ全体で無効にできるよう、`TTS_<PREFIX>_ENABLED` または `ASR_<PREFIX>_ENABLED` の扱いも合わせます。

### 画像・動画プロバイダーを追加する

`lib/media/` に実装を置きます。
生成は非同期のジョブになることが多く、ポーリング、タイムアウト、失敗時の再試行を定義します。
`image` と `video` スロットから解決できるようにします。

### シーンの種類を増やす

シーン種別はデータ契約、生成、描画、再生の 4 か所に影響します。

1. `packages/@openmaic/dsl/src/stage.ts` の `SceneType` と `SCENE_TYPES` に追加する。
2. `packages/@openmaic/generation/` に生成プロンプトと検証を追加する。
3. `components/scene-renderers/` に描画コンポーネントを追加する。
4. 再生と書き出し（PPTX、HTML、ZIP）の対応を追加する。
5. `lib/config/model-slots.ts` に対応するスロットが必要なら追加する。

`@openmaic/dsl` は下流のデプロイが検証に使う契約です。
既存の文書が持てる内容を狭める変更は、差分が小さく見えても破壊的変更として扱います。

### エージェントのツールを追加する

教室のディレクター用ツールは `lib/chat/pi/tools/` にあります。
ワークベンチ用のツールは `lib/server/agent-runtime/` と `lib/agent-runtime/` にあります。

ツールは、入力スキーマ、実行、失敗時の戻り値、タイムアウトを定義します。
ファイルや外部 URL を扱う場合は、既存の URL ガードを通してください。
コースの読み書きはオーナーの範囲を越えないようにします。

### スキルを追加する

`skills/agent-runtime/` に `SKILL.md` を置きます。
スキルは、いつ使うか、何を確認するか、どのツールをどの順で呼ぶかを文章で定義します。

利用者が作るスキルはオーナーごとに保存されます。
組み込みスキルと同じ名前空間を汚さないようにしてください。

### 書き出し形式を追加する

PPTX と HTML の書き出しは `lib/export/` にあります。
オフライン HTML は `lib/standalone-player/` のプレイヤーを使います。
インタラクティブシーンの外部資産を埋め込む処理は、書き出し時に URL を解決して `data:` URI に変換します。

### ホスト機能を組み込む

`instrumentation.ts` で、独自の認証メソッドやホスト拡張フックを登録できます。
コース作成、ライブラリ、アップロード、アセットのバイトストアにフックがあります。
既存のオーナー分離を壊さないように実装します。

## コーディング規約

- TypeScript は `strict: true`。`any` で逃げず、境界で検証する。
- パスエイリアスは `@/*` を使う。
- 整形は Prettier、静的検査は ESLint に従う。
- 共有層では、特定のモデルやサービスベンダーをハードコードしない。
- サーバー専用の処理をクライアントへ漏らさない。資格情報はブラウザへ渡さない。
- コース、セッション、素材、設定の読み書きはオーナーで絞る。
- 利用者が指定した URL へのサーバー側リクエストは、既存の URL ガードを通す。

## ストレージの変更

`packages/@openmaic/storage` のスキーマを変える場合、すでにデプロイされているデータベースと互換性を保つ必要があります。

- 既存のデータを壊さない移行にする。
- 新しい列やテーブルは、古いインスタンスが動いている間も安全に追加できる形にする。
- バージョンを上げるパッケージは、同じ PR で `version` を更新する。
- ロールバック手順と、混在バージョン時の注意を `CHANGELOG.md` に書く。

## 公開パッケージのバージョン

`scripts/openmaic-packages.mjs` に載っている `@openmaic/*` は npm に公開されます。
公開対象のファイルを変更した場合、同じ PR でそのパッケージの `version` を上げます。
CI の `check:package-versions` がこれを検査します。

| 変更 | 上げ方 |
| --- | --- |
| 文書化された振る舞いを変えない修正 | patch |
| 既存の利用者が無視できる新機能 | minor |
| 既存の利用者が対応を迫られる変更 | major |

`1.0.0` 未満のパッケージでは、minor が破壊的変更、patch が互換変更を意味します。
`@openmaic/dsl` は特に慎重に扱います。
文書が持てる内容を狭める変更は、見た目が小さくても破壊的変更です。

公開作業は自動です。
マージ後に、まだレジストリにないバージョンがリリースされ、`@openmaic/<name>@<version>` タグが付きます。

## テスト

- **ユニットテスト**：Vitest。`pnpm test`。
- **E2E**：Playwright。`pnpm test:e2e`。PostgreSQL が必要。
- **評価**：`eval/` のスクリプト。生成品質、白板レイアウト、構成案の言語、オーケストレーションを測る。
- **パッケージのスモークテスト**：`pnpm test:package-tarballs`。

変更が公開パッケージに触れる場合は、パッケージ単体のビルドとテストも確認します。

## コントリビュート

貢献の種類ごとの進め方は `CONTRIBUTING.md` にあります。

| 種類 | 進め方 |
| --- | --- |
| バグ修正 | 直接 PR を出す。Issue があればリンクする |
| 既存機能の拡張（プロバイダー追加など） | 直接 PR を出す |
| 新機能、アーキテクチャ変更 | 先に GitHub Discussion か Discord で相談する |
| デザイン、UI 変更 | 先に相談し、モックアップかスクリーンショットを添える |
| リファクタリングのみ | メンテナーが明示的に依頼した場合を除き受け付けない |
| ドキュメント | 直接 PR を出す |

Issue を拾う場合は、着手前にコメントして担当を表明します。
1 日以内に PR か進捗のコメントがない場合、別の人に再割り当てされることがあります。

AI 支援の PR は歓迎されています。
PR のタイトルか説明に AI 支援であることを書き、提出前に AI レビューを受けて指摘を処理します。
提出したコードの内容は提出者が理解している責任があります。

## レビューの観点

このリポジトリの `AGENTS.md` は、自動レビューと開発者の双方に次の観点を求めています。

- **オーナー境界**：コース、セッション、素材、設定の読み書きがオーナーの範囲を越えない。
- **ストレージ互換性**：既存のデータベースで動く移行になっている。
- **公開パッケージ**：振る舞いの変更にバージョン更新が伴っている。
- **プロバイダー中立性**：共有層に特定ベンダーの処理を埋め込まない。
- **URL ガード**：利用者が指定した URL へのサーバー側リクエストがガードを通っている。

重大度は、実行時の誤動作、データ損失、オーナー間のデータ露出、認証回避、移行失敗、壊れたパッケージの公開、秘密の漏えいを P1 とします。
文書やコメントの不正確さは P2 以下です。

## デバッグの勘所

- **起動時の設定エラー**：`openmaic.yml` の誤りは、起動時にフィールド名または行番号付きで報告される。
- **ヘルスチェック**：`/api/health` でアクセスコードの設定状態などを確認できる。
- **プロバイダー一覧**：`/api/server-providers` でサーバーが認識しているプロバイダーを確認できる。
- **モデル解決**：`lib/server/model-config/resolve-slot.ts` の解決順を読む。推測でフォールバックしない。
- **ログ**：`LOG_LEVEL` と `LOG_FORMAT` で調整する。
- **生成ジョブ**：`/api/generation-runs` と PostgreSQL のジョブレコードを確認する。
- **エージェントセッション**：`/api/agent/sessions` は `OPENMAIC_AGENT_RUNTIME_ENABLED=true` のときだけ有効。

## リリース

アプリのバージョンは `vX.Y.Z` タグと GitHub Releases で管理します。
minor はテーマのあるリリース、patch は修正とセキュリティが中心です。
大きな移行は `-rc.N` のプレリリースを経ます。

すべてのリリースに `CHANGELOG.md` の節があり、GitHub Release のタイトルがその見出しになります。

---

本資料は OpenCode + DeepSeek V4.1 Flash Free により生成されました。
