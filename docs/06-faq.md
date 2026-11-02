# FAQ と用語集

> 生成: OpenCode + DeepSeek V4.1 Flash Free（2026-11-02）

## よくある質問

### OpenMAIC は無料で使えますか

本体は MIT ライセンスで、商用利用も無償です。
ただし、生成に使うモデルプロバイダーの API 利用料は別途かかります。
ローカルの Ollama や Lemonade を使えば、モデル利用料を抑えられます。

### インターネットなしで動かせますか

セルフホストすれば、アプリ本体はローカルで動きます。
ただし、クラウドのモデルプロバイダーを使う場合はネットワークが必要です。
完全にオフラインにするには、ローカルモデルとローカルの TTS、ASR、文書解析を用意します。

書き出したオフライン HTML は、ネットワークなしで教室を再生できます。
ただし、書き出し時に取得できなかった外部資産は URL のまま残ります。

### Vercel にデプロイできますか

1.1.x までは可能でした。
1.2.0 以降は生成がリクエストを超えて継続するため、長時間稼働する Node.js プロセスと PostgreSQL が必要です。
Vercel などのサーバーレス環境はサポートされません。

### 日本語の授業を作れますか

UI は日本語に対応しています。
生成される授業の言語は、入力文とモデルの指示への追従性に依存します。
構成案の段階で言語を確認し、必要なら修正してください。

### データはどこに保存されますか

コース、フォルダ、チャット履歴、学習者の状態、生成メディアは PostgreSQL に保存されます。
メディアのバイト列は、設定に応じて PostgreSQL または S3 互換ストレージに置かれます。
ブラウザには設定、再生位置、キャッシュなど、その端末に属する情報だけが残ります。

### 複数人で同じライブラリを使えますか

使えます。
`PERSISTENCE_SHARED_OWNER_ID` と `ACCESS_CODE` を設定すると、チームで 1 つのライブラリを共有できます。
個人用のデプロイなら `OWNER_SINGLE_USER=true` です。
個人ごとに分けたい場合は、`instrumentation.ts` に独自の認証メソッドを登録します。

### 既存の PowerPoint を取り込めますか

取り込めます。
`NEXT_PUBLIC_ENABLE_PPTX_IMPORT=true` で入口を有効にします。
レイアウトを保ったままスライドとして読み込みます。

### 生成した授業を配布できますか

できます。
PPTX、リソースパック、オフライン HTML、教室 ZIP の 4 形式で書き出せます。
ZIP は別のデプロイへ移すのにも使えます。

### 授業を動画にできますか

`render-service` を起動し、`RENDER_SERVICE_URL` と `NEXT_PUBLIC_ENABLE_VIDEO_EXPORT=true` を設定すると、MP4 として書き出せます。
サービスがない場合は、プロジェクト ZIP のダウンロードに縮退します。

### どのモデルを選べばよいですか

リポジトリの README は、画像生成、ナレーション、動画、Web 検索、ページ取得をすべて有効にした構成を勧めています。
既定のチャットモデルには、長い文脈を扱える高速なモデルを選ぶと安定します。
実際のモデル ID は頻繁に変わるため、`openmaic.example.yml` と公式の `supported-models.mdx` を確認してください。

### モデルを追加するにはどうしますか

`openmaic.yml` の `providers` にプロバイダーを追加し、`slots` で用途に割り当てます。
API キーは `.env.local` に置き、`${VAR}` で参照します。
サーバー管理のプロバイダーでは、使うモデルを `models` の許可リストに入れます。

### 声をクローンできますか

VoxCPM2 を `tts` スロットに割り当てた場合にできます。
Clone voice では、短い参照音声をアップロードするか、ブラウザで録音します。
参照音声はブラウザの IndexedDB に保存され、合成のたびにバックエンドへ送られます。
声の登録は `vllm-omni` バックエンドでのみ動きます。

### セキュリティで何に注意すればよいですか

- ネットワークに公開する前に `ACCESS_CODE` を設定する。
- 公開環境では `ALLOW_LOCAL_NETWORKS` を有効にしない。
- `OPENMAIC_SECRET_KEY` をデータベースと一緒に保管する。
- 独自の認証を入れる場合は、オーナーの解決を迂回しない。
- 利用者が指定した URL を扱う処理は、既存の URL ガードを通す。

### 商用利用できますか

できます。
本体は MIT ライセンスです。
同梱の `packages/mathml2omml` は LGPL-3.0-or-later、`packages/pptxgenjs` はサードパーティの MIT ライセンスなので、再配布時はそれぞれの条件を確認してください。

### 生成が途中で止まった場合は

生成ジョブは PostgreSQL にチェックポイントを保存します。
サーバープロセスが落ちても、別のプロセスが最後のチェックポイントから再開します。
ブラウザを閉じただけなら、処理はサーバー側で継続します。

### 公式ドキュメントはどこにありますか

リポジトリ内の `packages/docs/content/docs/` にあります。
英語の `*.mdx` に加えて、日本語の `*.ja.mdx` も用意されています。
デモは [open.maic.chat](https://open.maic.chat/) で公開されています。

## 用語集

**アクション（Action）**：シーン内でエージェントが行う操作。発話、描画、スポットライト、レーザーなど。

**アセット（Asset）**：生成された画像、音声、動画などのバイナリ資産。PostgreSQL か S3 に保存する。

**エージェント（Agent）**：AI 教師または AI クラスメート。ペルソナ、声、役割を持つ。

**オーナー（Owner）**：コースの所有者。匿名 Cookie、共有チーム ID、単一ユーザー、独自アカウントのいずれか。

**構成案（Outline）**：生成の第 1 段階で作る、コースの章立てと各ページの役割。

**コース（Course）**：学習者が開く 1 つの教室。データ上はステージ。

**シーン（Scene）**：教室の 1 ページ。`slide`、`quiz`、`interactive`、`pbl` の 4 種類。

**ジョブ（Generation Run）**：サーバー側で実行される生成処理の単位。PostgreSQL のレコードとして管理される。

**スキル（Skill）**：エージェントに渡す手順書。`SKILL.md` 形式で、いつ、何を、どの順で行うかを書く。

**スロット（Slot）**：AI の用途ごとの設定単位。`llm`、`tts`、`image` など。

**ステージ（Stage）**：コース全体のデータ。メタ情報とシーンの並びを持つ。

**Pi**：教室の進行を担うサーバー側のディレクター。各ターンをエージェントに割り当てる。

**PBL**：Project-Based Learning。役割、マイルストーン、成果物を伴うプロジェクト型学習。

**DSL**：Domain Specific Language。OpenMAIC ではコースとスライドのデータ契約を指す。

**TTS**：Text-to-Speech。テキストの読み上げ。

**ASR**：Automatic Speech Recognition。音声の文字起こし。

**SSRF**：Server-Side Request Forgery。サーバーに任意の URL を踏ませる攻撃。OpenMAIC は URL ガードで防ぐ。

**レンダーサービス（Render Service）**：Chromium と FFmpeg で MP4 を生成する独立コンテナ。

**ワークベンチ（Workbench）**：会話しながらコースを組み立てる Pro 向けの画面。

**ナレッジベース**：アップロード資料の保管場所。フォルダで整理し、一度だけ解析して再利用する。

## 参考リンク

| 名称 | URL |
| --- | --- |
| GitHub リポジトリ | https://github.com/THU-MAIC/OpenMAIC |
| ライブデモ | https://open.maic.chat/ |
| 公式ドキュメント（英語） | `packages/docs/content/docs/` |
| 公式ドキュメント（日本語） | `packages/docs/content/docs/*.ja.mdx` |
| 論文（JCST 2026） | https://jcst.ict.ac.cn/en/article/doi/10.1007/s11390-025-6000-0 |
| Discord | https://discord.gg/p8Pf2r3SaG |
| Feishu コミュニティ | `community/feishu.md` |
| OpenClaw | https://github.com/openclaw/openclaw |
| MAIC-UI | https://github.com/THU-MAIC/MAIC-UI |
| MinerU | https://github.com/opendatalab/MinerU |
| VoxCPM | https://github.com/OpenBMB/VoxCPM |
| FunASR | https://github.com/modelscope/FunASR |

## 本資料の生成情報

| 項目 | 内容 |
| --- | --- |
| 生成ツール | OpenCode |
| 生成モデル | DeepSeek V4.1 Flash Free |
| 生成日 | 2026-11-02 |
| 対象リポジトリ | `THU-MAIC/OpenMAIC` |
| 対象バージョン | 1.3.0 |
| 参照コミット | `595a7679` |
| 根拠資料 | `README.md`、`CHANGELOG.md`、`package.json`、`openmaic.example.yml`、`.env.example`、`CONTRIBUTING.md`、`AGENTS.md`、`packages/docs/`、`lib/`、`app/`、`packages/@openmaic/` |

本資料は非公式の解説です。
仕様の最終的な根拠は、リポジトリのソースコードと公式ドキュメントにあります。

---

本資料は OpenCode + DeepSeek V4.1 Flash Free により生成されました。
