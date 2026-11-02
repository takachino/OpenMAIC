# OpenMAIC 日本語解説資料

OpenMAIC（Open Multi-Agent Interactive Classroom）の目的、仕組み、導入手順、機能、開発への参加方法を日本語でまとめた資料です。

> **本資料の生成について**
> 本資料は [OpenCode](https://opencode.ai) 上の **DeepSeek V4.1 Flash Free** が生成しました。
> 対象リポジトリは `THU-MAIC/OpenMAIC`、参照時点のバージョンは **1.3.0**（コミット `595a7679`）、生成日は **2026-11-02** です。
> 内容はリポジトリ内の `README.md`、`CHANGELOG.md`、`package.json`、`openmaic.example.yml`、`packages/docs/` とソースコードを根拠にしています。

## この資料の位置づけ

OpenMAIC の公式ドキュメントはリポジトリ内の `packages/docs/content/docs/` にあり、日本語版（`*.ja.mdx`）も用意されています。
本資料は、初めてリポジトリを読む人向けに「全体像から開発参加まで」を一続きで説明する非公式の解説です。
設定値や API の最終的な仕様は、公式ドキュメントとソースコードを優先してください。

## 目次

| 資料 | 内容 |
| --- | --- |
| [01-overview.md](01-overview.md) | OpenMAIC が解く課題、できること、設計の考え方、用語、制約 |
| [02-architecture.md](02-architecture.md) | 全体構成、生成パイプライン、マルチエージェント、再生エンジン、永続化、モデル解決 |
| [03-setup.md](03-setup.md) | 前提条件、クイックスタート、設定ファイル、データベース、Docker、任意機能、トラブルシュート |
| [04-features.md](04-features.md) | 授業生成、シーン種別、教室体験、Deep Interactive、ワークベンチ、書き出し、連携 |
| [05-development.md](05-development.md) | リポジトリの読み方、拡張レシピ、テスト、評価、コントリビュート、セキュリティ |
| [06-faq.md](06-faq.md) | よくある質問、用語集、参考リンク |

## 30 秒でわかる OpenMAIC

OpenMAIC は、任意のテーマや手持ちの資料から、スライド、クイズ、インタラクティブ教材、PBL（プロジェクト型学習）を組み合わせた「教室」を自動生成するオープンソースの AI プラットフォームです。
生成した教室では、AI 教師と AI クラスメートが音声で説明し、ホワイトボードに描き、学習者とその場で対話します。

| 項目 | 内容 |
| --- | --- |
| 正式名 | Open Multi-Agent Interactive Classroom |
| 開発元 | THU-MAIC（清華大学 MAIC チーム） |
| ライセンス | MIT（同梱の一部パッケージは別ライセンス） |
| 現在のバージョン | 1.3.0 |
| 主な技術 | Next.js 16、React 19、TypeScript 5、Tailwind CSS 4、PostgreSQL 16 |
| 必要なもの | Node.js 22.19 以上、pnpm 10、PostgreSQL 16、1 つ以上のモデルプロバイダーの API キー |
| 実行形態 | 長時間稼働する Node.js サーバー（1.2.0 以降、Vercel などのサーバーレスは非対応） |

## 最初に読む順序

1. まず [01-overview.md](01-overview.md) で、何が作れるのかと用語を把握する。
2. 実際に動かす場合は [03-setup.md](03-setup.md) のクイックスタートへ進む。
3. コードを読む、あるいは拡張する場合は [02-architecture.md](02-architecture.md) と [05-development.md](05-development.md) を参照する。
4. 機能の詳細や書き出し形式は [04-features.md](04-features.md) にまとめてある。

## 表記について

- ファイルパスはリポジトリルートからの相対パスで示します。
- コマンドは特に断りがない限り、リポジトリルートで実行するものとします。
- 「スロット」「オーナー」「ステージ」「シーン」などは OpenMAIC 固有の用語です。定義は [01-overview.md](01-overview.md#用語) と [06-faq.md](06-faq.md#用語集) にあります。
- 本資料のコード例は 1.3.0 時点のものです。バージョンアップ時は `CHANGELOG.md` の破壊的変更を確認してください。

---

本資料は OpenCode + DeepSeek V4.1 Flash Free により生成されました。
