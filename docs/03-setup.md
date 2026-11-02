# セットアップと設定

> 生成: OpenCode + DeepSeek V4.1 Flash Free（2026-11-02）

## 前提条件

| 項目 | 要件 |
| --- | --- |
| Node.js | 22.19 以上（`.nvmrc` は 22） |
| pnpm | 10 系（`packageManager` は 10.28.0） |
| PostgreSQL | 16 |
| Docker | ローカル DB を `pnpm db:up` で起動する場合に必要。任意の PostgreSQL 16 でもよい |
| モデル | LLM プロバイダーの API キーが 1 つ以上。Ollama や Lemonade ならキー不要 |

`pnpm install` の `postinstall` でワークスペースパッケージがビルドされます。
初回は数分かかることがあります。

## クイックスタート

```bash
git clone https://github.com/THU-MAIC/OpenMAIC.git
cd OpenMAIC
pnpm install
```

環境ファイルとモデル設定の雛形をコピーします。

```bash
cp .env.example .env.local
cp openmaic.example.yml openmaic.yml
```

`.env.local` に最低限のキーを設定します。

```env
OPENAI_API_KEY=sk-...
```

`openmaic.yml` は雛形のままで動きます。
OpenAI 以外を使う場合は、`providers` と `slots` を自分の環境に合わせて書き換えます。

```yaml
providers:
  openai:
    preset: openai
    apiKey: ${OPENAI_API_KEY}
    models: [gpt-5.5]

slots:
  llm: openai:gpt-5.5
```

開発用の PostgreSQL を起動します。

```bash
pnpm db:up
```

`.env.local` の `DATABASE_URL` 行を有効にします。

```env
DATABASE_URL=postgres://openmaic:openmaic-dev@127.0.0.1:5432/openmaic
```

開発サーバーを起動します。

```bash
pnpm dev
```

`http://localhost:3000` を開きます。
`DATABASE_URL` がない場合、サーバーは起動を拒否し、設定方法を表示して終了します。

## 設定ファイルの役割

OpenMAIC の設定は 2 つのファイルに分かれます。

**`.env.local`** は秘密情報とサーバーの動作を設定します。
API キー、データベース接続先、アクセス制御、feature flag、チューニング値がここに入ります。

**`openmaic.yml`** は「どのモデルをどの用途に使うか」を設定します。
プロバイダーのアカウントと、スロットへの割り当てを書きます。
ファイルは起動時に一度だけ読まれるため、変更したらサーバーを再起動します。

`openmaic.yml` がない場合は、旧来の `DEFAULT_MODEL`、`MODEL_FALLBACK`、`<PROVIDER>_API_KEY` 形式が使えます。
ただし、これらは非推奨です。
`MODEL_ROUTES` は 1.2.0 以降読まれず、設定していると起動に失敗します。

## モデルの設定

### スロットの考え方

スロットは AI の用途ごとの設定単位です。
未設定のスロットは親を継承するため、通常は `llm` だけを設定すれば動きます。

| スロット | 用途 |
| --- | --- |
| `llm` | チャットモデルの既定。すべてのチャット系スロットの親 |
| `course.research` | 調査、検索クエリの書き換え |
| `course.outline` | コースの構成案 |
| `course.agents` | エージェントのペルソナ生成 |
| `course.content` | シーン内容の生成。`slide`、`quiz`、`interactive`、`pbl` に分岐 |
| `course.actions` | 発話や描画などのアクション生成 |
| `classroom` | 教室での採点、PBL 実行、チャット |
| `agent` | Pro ワークベンチのエージェント。ツール呼び出し必須 |
| `tts` | 読み上げ |
| `asr` | 音声認識 |
| `image` | 画像生成 |
| `video` | 動画生成 |
| `webSearch` | Web 検索 |
| `webFetch` | Web ページの取得 |
| `document` | 文書解析 |

### プロバイダーの例

OpenAI を既定にする場合です。

```yaml
providers:
  openai:
    preset: openai
    apiKey: ${OPENAI_API_KEY}
    models: [gpt-5.5]

slots:
  llm: openai:gpt-5.5
```

Anthropic を構成案にだけ使う場合です。

```yaml
providers:
  anthropic:
    preset: anthropic
    apiKey: ${ANTHROPIC_API_KEY}

slots:
  llm: openai:gpt-5.5
  course.outline: anthropic:claude-sonnet-4-6
```

トークンプランは 1 つのキーで複数の能力を賄えます。
MiniMax の例です。

```yaml
providers:
  minimax:
    preset: minimax
    apiKey: ${MINIMAX_API_KEY}

slots:
  llm: minimax:MiniMax-M3
  image: minimax
  video: minimax
  tts: minimax
  webSearch: minimax
```

Ollama や Lemonade などのローカルモデルも、OpenAI 互換のエンドポイントとして設定できます。
ローカルネットワークへの接続が必要な場合は `ALLOW_LOCAL_NETWORKS=true` を設定します。
公開環境では有効にしないでください。

```yaml
providers:
  local:
    preset: openai-compatible
    baseUrl: http://localhost:11434/v1
    models: [qwen3:8b]

slots:
  llm: local:qwen3:8b
```

### スロットの固定と利用者キー

`lock` を書くと、指定したスロットを利用者が変更できなくなります。
`allowUserKeys: false` にすると、利用者は独自のプロバイダーやキーを追加できなくなります。

```yaml
slots:
  llm: openai:gpt-5.5
  video: null

lock: [video]
allowUserKeys: false
```

`null` はその能力を既定で無効にします。
`lock` に含めなければ、利用者が後から有効にできます。

## データベースと永続化

1.2.0 以降、コースは PostgreSQL に保存されます。
`DATABASE_URL` は必須です。

ローカル開発では `pnpm db:up` を使います。
これは `openmaic-dev-db` という独立した Compose プロジェクトを起動し、`127.0.0.1:5432` で待ち受けます。
`pnpm db:down` で停止しますが、データは残ります。
別のポートを使う場合は `OPENMAIC_DB_PORT` を設定します。

アセットのバイト列は既定で PostgreSQL に保存されます。
S3 互換ストレージに置く場合は `ASSET_S3_BUCKET` を設定します。
MinIO などパス形式が必要なストアでは `AWS_S3_FORCE_PATH_STYLE=1` を使います。

## オーナーとアクセス制御

すべてのリクエストはオーナーに解決され、オーナーごとにライブラリが分かれます。

| モード | 設定 | ライブラリ |
| --- | --- | --- |
| 単一ユーザー（Compose の既定） | `OWNER_SINGLE_USER=true` | サーバーに到達できる全員で 1 つ。`ACCESS_CODE` かループバックで守る |
| 共有チーム | `PERSISTENCE_SHARED_OWNER_ID=<id>` と `ACCESS_CODE` | アクセスコードの内側で 1 つ |
| 匿名（どちらも未設定の既定） | なし | ブラウザ Cookie ごとに 1 つ。別のブラウザは空に見える |
| 独自アカウント | `instrumentation.ts` に認証メソッドを登録 | サインインしたアカウントごとに 1 つ |

`ACCESS_CODE` はサイト全体のパスワードです。
16 文字以上のランダムな値を使います。
設定しない場合、ミドルウェアは認証を行わず、到達できる人は誰でもコースを読み書きできます。

```env
ACCESS_CODE=your-long-random-secret
```

アクセスコードは署名付きの HTTP-only Cookie に 7 日間保存されます。
レート制限は、信頼できるリバースプロキシの背後で `TRUST_PROXY_HEADERS=true` を設定した場合だけ有効になります。

## Docker Compose での起動

```bash
cp .env.example .env.local
# .env.local に API キーを書く
docker compose up --build
```

`http://localhost:3000` を開きます。
構成はアプリと PostgreSQL の 2 コンテナです。
コース、生成メディア、実行時セッションは `openmaic-postgres` と `openmaic-data` の名前付きボリュームに残ります。
`docker compose down -v` を実行すると削除されます。

Compose の構成は個人インストール向けで、単一ユーザーモードかつ `127.0.0.1:3000` のみの公開です。
他のマシンに公開する場合は、次の 3 つを設定します。

```bash
ACCESS_CODE=...                       # .env.local
PERSISTENCE_POSTGRES_PASSWORD=...     # 初回起動前。英数字のランダム値
OPENMAIC_PUBLISH_ADDRESS=0.0.0.0 docker compose up -d --build
```

`OPENMAIC_PUBLISH_ADDRESS`、`OPENMAIC_PORT`、`PERSISTENCE_POSTGRES_PASSWORD` は `.env.local` ではなく、シェルまたは `docker-compose.yml` の隣の `.env` から読みます。

## 本番ビルド

```bash
pnpm build
DATABASE_URL=postgres://... pnpm start
```

`pnpm start` は `next start` を実行します。
生成処理がプロセス内で動くため、プロセスマネージャーやコンテナで常駐させてください。

サーバーレス環境は 1.2.0 以降サポートされません。
Vercel で動かせるのは 1.1.x までで、その場合は `release/1.1.x` ブランチを使います。
1.1.x から 1.2.0 以降へ移行する場合は、`DATABASE_URL` の向き先とオーナーモードを最初の起動前に決めます。

## 任意機能の有効化

### Pro ワークベンチとエージェントランタイム

```env
NEXT_PUBLIC_PRO_WORKBENCH_ENABLED=true
OPENMAIC_AGENT_RUNTIME_ENABLED=true
DATABASE_URL=postgres://openmaic:openmaic-dev@127.0.0.1:5432/openmaic
```

`NEXT_PUBLIC_*` はビルド時にバンドルへ埋め込まれるため、変更には再ビルドが必要です。
エージェントは `agent` スロットで動き、ツール呼び出しに対応したモデルが必要です。

```yaml
slots:
  llm: openai:gpt-5.5
  agent:
    model: openai:gpt-5.5
    api: openai-completions
```

`agent` スロットには `thinking.effort` を設定できません。

### MP4 書き出し

MP4 の生成には Chromium と FFmpeg が必要なため、アプリとは別の `render-service` コンテナで動きます。

```bash
docker compose --profile video-export up --build
```

`RENDER_SERVICE_URL` が設定されていれば、アプリは自動的にサービスを検出します。
設定されていない場合は、プロジェクト ZIP のダウンロードに縮退します。
`NEXT_PUBLIC_ENABLE_VIDEO_EXPORT=true` も必要です。

### PPTX インポート

```env
NEXT_PUBLIC_ENABLE_PPTX_IMPORT=true
```

既存の PowerPoint を取り込み、レイアウトを保ったままスライドとして使えます。

## 外部サービスとの接続

### 読み上げと音声認識

TTS は OpenAI、Azure、GLM、Qwen、Doubao、MiniMax、ElevenLabs、Google、VoxCPM2、Lemonade などに対応します。
ASR は OpenAI、Qwen、Azure、FunASR、Lemonade などに対応します。

FunASR をローカルで動かす例です。

```bash
python -m pip install torch torchaudio
python -m pip install "funasr==1.4.0" fastapi uvicorn python-multipart
funasr-server --device cuda --model fun-asr-nano
```

```yaml
providers:
  funasr:
    preset: funasr-asr
    baseUrl: http://localhost:8000/v1

slots:
  asr: funasr
```

音声・動画資料のローカル抽出には、`ffmpeg` と `ffprobe` が `PATH` に必要です。
どちらもない場合、ローカル抽出はスキップされ、AliDocMind などのクラウド経路が使われます。

### Web 検索とページ取得

検索プロバイダーは Tavily、Exa、Firecrawl、Bocha、Brave、Baidu、SearXNG、MiniMax、Doubao、Claude などに対応します。
ページ取得（`webFetch`）は DeepSeek、Kimi、Firecrawl のホスト型リーダーを選べます。

```yaml
providers:
  tavily:
    preset: tavily
    apiKey: ${TAVILY_API_KEY}

slots:
  webSearch: tavily
```

### 文書解析

複雑な表、数式、OCR が必要な場合は MinerU を使います。
公式 API の `mineru-cloud` か、自前で立てた `mineru` を選べます。

```yaml
providers:
  mineru:
    preset: mineru-cloud
    apiKey: ${PDF_MINERU_CLOUD_API_KEY}

slots:
  document: mineru
```

自前の MinerU は、ベース URL がない場合にクラウドへ暗黙にフォールバックしません。
クラウドへのフォールバックを許す場合は `ALLOW_MINERU_CLOUD_FALLBACK=true` を明示します。

### VoxCPM2 と音声クローン

VoxCPM2 は OpenBMB のオープンソース TTS で、声のクローンに対応します。
バックエンドは vLLM-Omni、Python API、Nano-vLLM の 3 種類です。

```yaml
providers:
  voxcpm:
    preset: voxcpm-tts
    baseUrl: http://localhost:8000/v1
    options:
      backend: vllm-omni

slots:
  tts: voxcpm
```

声のモードは Auto Voice、Prompt voice、Clone voice の 3 つです。
Clone voice の参照音声はブラウザの IndexedDB に保存され、合成のたびにバックエンドへ送られます。

## トラブルシュート

**サーバーが起動しない（`DATABASE_URL`）**
`DATABASE_URL` を設定してください。
ローカルなら `pnpm db:up` のあと、`.env.local` の該当行を有効にします。

**生成が始まらない、または失敗する**
`openmaic.yml`、`DEFAULT_MODEL`、画面のモデル設定のいずれかでモデルを指定しているか確認します。
未設定の場合、推測せずに失敗します。
起動ログにモデル設定の警告が出ていないかも確認してください。

**プロバイダーが 401 を返す**
API キーが `.env.local` にあり、`openmaic.yml` から `${VAR}` で参照されているか確認します。
サーバー管理のプロバイダーでは、使うモデルが `models` の許可リストに入っている必要があります。

**Safari で localhost の Cookie が保存されない**
本番ビルドの Cookie には `Secure` が付きます。
TLS なしのデプロイでは `COOKIE_SECURE=0` を設定します。
ただし、信頼できるネットワークかローカルだけで使ってください。

**動画の書き出しが ZIP になる**
`RENDER_SERVICE_URL` と `NEXT_PUBLIC_ENABLE_VIDEO_EXPORT=true` を確認します。
`render-service` はアプリと同じバージョンにそろえてください。

**Pro ワークベンチが出ない**
`NEXT_PUBLIC_PRO_WORKBENCH_ENABLED=true` で再ビルドしたか、`OPENMAIC_AGENT_RUNTIME_ENABLED=true` と `agent` スロットが設定されているかを確認します。

**画面の言語を変えたい**
UI は 12 ロケールに対応しています。
右上の言語切り替えから変更できます。
生成される授業の言語は、入力と設定に依存します。

## アップグレード時の注意

- アップグレード前に `CHANGELOG.md` の Breaking Changes を読む。
- 1.3.0 では、旧バージョンのインスタンスをすべて停止してから新バージョンを起動する。
  混在したローリング更新は行わない。
- 1.3.0 より前へロールバックしない。
- `MATERIALS_POOL_BACKFILL=1` は、すべての旧インスタンスを停止したあとで設定し、再起動する。
- `render-service` はアプリと同じタイミングか、それより先に更新する。
- 独自のマイグレーションでスキーマを管理している場合は、新しいテーブルと列を先に追加する。

---

本資料は OpenCode + DeepSeek V4.1 Flash Free により生成されました。
