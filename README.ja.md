# PengSheets — Markdown スプレッドシートエディタ

<p align="center">
  <img src="./images/icon.png" alt="PengSheets Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Markdownテーブルを、パワフルなスプレッドシート体験に変える。</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=f-y.peng-sheets">
    <img src="https://img.shields.io/visual-studio-marketplace/v/f-y.peng-sheets?style=flat-square&label=version" alt="Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=f-y.peng-sheets">
    <img src="https://img.shields.io/visual-studio-marketplace/i/f-y.peng-sheets?style=flat-square&label=installs" alt="Installs">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=f-y.peng-sheets">
    <img src="https://img.shields.io/visual-studio-marketplace/r/f-y.peng-sheets?style=flat-square&label=rating" alt="Rating">
  </a>
  <a href="https://github.com/f-y/peng-sheets/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License">
  </a>
</p>

<p align="center">
  <a href="#-特徴">特徴</a> •
  <a href="#-クイックスタート">クイックスタート</a> •
  <a href="#️-設定">設定</a> •
  <a href="#-なぜpengsheets">なぜPengSheets?</a> •
  <a href="#️-ロードマップ">ロードマップ</a> •
  <a href="#-コントリビューション">コントリビューション</a>
</p>

---

<p align="center">
  <img src="./images/demo.gif" alt="PengSheets デモ" width="800">
</p>

**PengSheets**は、Markdownテーブルをリッチでインタラクティブなスプレッドシートビューに変換します。[md-spreadsheet-parser](https://github.com/f-y/md-spreadsheet-parser)を活用し、堅牢なPythonパーサーをWebAssembly経由でエディタ内で直接実行することで、優れた解析精度とシームレスなマルチシートサポートを提供します。

## ✨ 特徴

| 機能 | 説明 |
|:--------|:------------|
| 🎯 **Excel風の編集** | 馴染みのあるスプレッドシート操作でMarkdownテーブルをナビゲート・編集 |
| 📑 **マルチシートワークブック** | Markdownヘッダーを使って複数のシートでデータを整理 |
| ⚡ **リアルタイム同期** | スプレッドシートでの変更が即座にMarkdownソースに反映 |
| 🐍 **Python駆動の解析** | 信頼性の高いWebAssemblyベースのPythonパーサー |
| 🌍 **多言語対応UI** | 英語と日本語のインターフェースをサポート |
| 🎨 **ネイティブなVS Codeルック** | VS Codeテーマとシームレスに統合 |

## 🚀 クイックスタート

1. **インストール** - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=f-y.peng-sheets)から拡張機能をインストール

2. **開く** - テーブルを含むMarkdownファイル（`.md`）を開く

3. **起動** - スプレッドシートエディタを起動:
   - エディタのタイトルバーにある**テーブルアイコン**をクリック（最速！）
   
     ![タイトルバーのテーブルアイコン](./images/screenshot-title-bar-icon.png)
   
   - または、エクスプローラーで`.md`ファイルを右クリックし、**`PengSheetsで開く`**を選択
   - または、コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）を開いて実行: **`PengSheets: Open Editor`**

4. **編集** - スプレッドシートインターフェースでテーブルを編集 — 変更は自動的に同期されます！

> **ヒント:** `PengSheets: New Workbook`コマンドで新しいワークブックを作成できます。

## ⚙️ 設定

PengeSheets はドキュメントスタイルに合わせて幅広くカスタマイズできます：

| 設定 | 説明 | デフォルト |
|:--------|:------------|:--------|
| `pengSheets.parsing.rootMarker` | データセクションの開始を示すマーカー | `# Tables` |
| `pengSheets.parsing.sheetHeaderLevel` | シート名のヘッダーレベル（例: 2 で `##`）| `2` |
| `pengSheets.parsing.tableHeaderLevel` | テーブル名のヘッダーレベル（例: 3 で `###`）| `3` |
| `pengSheets.parsing.captureDescription` | ヘッダーとテーブル間のテキストを説明として取得 | `true` |
| `pengSheets.parsing.columnSeparator` | 列の区切り文字 | `\|` |
| `pengSheets.parsing.headerSeparatorChar` | ヘッダー区切り文字 | `-` |
| `pengSheets.parsing.requireOuterPipes` | 生成されるテーブルに外側のパイプを必須とする | `true` |
| `pengSheets.parsing.stripWhitespace` | セル値から空白を除去 | `true` |
| `pengSheets.language` | UI言語（`auto`, `en`, `ja`） | `auto` |
| `pengSheets.validation.dateFormat` | バリデーションセルの日付形式 | `YYYY-MM-DD` |

## 🤔 なぜPengSheets？

| | PengSheets | 他のMarkdownテーブルエディタ |
|:--|:--|:--|
| **マルチシート対応** | ✅ 完全なワークブック構成 | ❌ 単一テーブルのみ |
| **解析エンジン** | Python（WebAssembly）— 実戦で検証済み | JavaScript — エッジケース処理が限定的 |
| **リアルタイム同期** | ✅ 双方向 | ⚠️ 一方向が多い |
| **メタデータ対応** | ✅ テーブル説明、シート構成 | ❌ なし |
| **キーボードショートカット** | ✅ Excel風のナビゲーション | ⚠️ 限定的 |

## 🔧 アーキテクチャ

PengSheetsは最高のパフォーマンスと互換性のためにハイブリッドアーキテクチャを採用しています：

- **フロントエンド**: **Lit**と**VS Code Webview UI Toolkit**でネイティブな外観を実現
- **バックエンド（ブラウザ内）**: WebAssembly経由で**Python 3.12**を実行し、`md-spreadsheet-parser`ライブラリを動作
- **通信**: 標準のVS Codeメッセージング APIでエディタとWebview間をシームレスに同期

## 🐍 Pythonで利用

PengSheetsで作成したファイルは、[md-spreadsheet-parser](https://github.com/f-y/md-spreadsheet-parser)を使ってPythonスクリプトから簡単に読み込めます。Lookup APIで特定のシートとテーブルに名前でアクセス：

```python
from md_spreadsheet_parser import parse_workbook_from_file

# PengSheetsワークブックを読み込み
workbook = parse_workbook_from_file("data.md")

# シートとテーブルに名前でアクセス
sheet = workbook.get_sheet("売上データ")
table = sheet.get_table("Q1実績")

# データを利用
print(table.headers)  # ['年度', '売上']
print(table.rows)     # [['2024', '1000'], ['2025', '1500']]
```

パーサーのインストール：
```bash
pip install md-spreadsheet-parser
```

📚 詳しいレシピは[Cookbook（日本語）](https://github.com/f-y/md-spreadsheet-parser/blob/main/COOKBOOK.ja.md)をご覧ください（Pandas連携、Excel変換、型安全なバリデーションなど）。

## 🗺️ ロードマップ

PengSheetsを積極的に開発中です！予定している機能：

- [ ] CSV/Excelへのエクスポート
- [ ] 数式サポート（基本的な計算）
- [ ] セルの書式設定（太字、斜体、コード）
- [ ] データバリデーションの強化
- [ ] 大規模テーブルのパフォーマンス改善

## 🤝 コントリビューション

フィードバックやアイデアをお待ちしています！バグや機能リクエストがある場合：

1. 重複を避けるため、既存の[Issues](https://github.com/f-y/peng-sheets/issues)を確認
2. 明確な説明とともに新しい[Issue](https://github.com/f-y/peng-sheets/issues/new)を作成
3. 再現手順（バグの場合）またはユースケース（機能リクエストの場合）を含める

## 📄 ライセンス

このプロジェクトは[MITライセンス](LICENSE)の下でライセンスされています。

---

<p align="center">
  Made with ❤️ by the PengSheets team
</p>
