# Markdown Spreadsheet Overview

このドキュメントは、**VS Code Extension** と **Python Parser** の機能をデモンストレーションするためのハイブリッド・ノートブックです。
ドキュメントとしての記述（コンテキスト）と、スプレッドシートとしてのデータ（テーブル）を同一ファイルで管理できることの強力さを示します。
このファイル自体が `md-spreadsheet-parser` でパース可能な構造を持っています。

## 1. VS Code Extension Features

`vscode-md-spreadsheet` は、MarkdownのテーブルをExcelのような快適なUIで編集可能にする拡張機能です。

### Core Philosophy
- **Keyboard First**: 矢印キーでの移動、`F2`での編集、`Enter`/`Tab`でのコミットなど、Excelユーザーのメンタルモデルを尊重しています。
- **Hybrid View**: 通常のMarkdownテキスト記述（ドキュメントタブ）と、テーブル編集（シートタブ）をシームレスに切り替えます。
- **Safe Editing**: 強固な Undo/Redo システムを実装しており、誤操作を恐れることなく編集できます。

### Advanced Editing
- **Formula Columns**: データ（Markdown）とロジック（Metadata）を分離した新しい計算列の概念。
- **Standard Formatting**: Bold (`Ctx+B`), Italic (`Ctx+I`), Link (`Ctx+K`) などのMarkdown標準の装飾をサポート。
- **Metadata Persistence**: 列幅やフィルター設定などは、Markdownの可読性を損なわないようHTMLコメント内のメタデータとして保存されます。

## 2. Python Parser Capabilities

`md-spreadsheet-parser` ライブラリを使用することで、このようなMarkdownファイルをシンプルかつ型安全に扱うことができます。

### Basic Usage

```python
from md_spreadsheet_parser import parse_workbook

# このファイルを読み込む
wb = parse_workbook("hybrid_notebook.md")

# シートとテーブルにアクセス
sheet = wb.get_sheet("Comparison")
table = sheet.get_table("Excel vs MD Suite")

# 行データを取得
for row in table.rows:
    print(f"Feature: {row[0]}, VS Code: {row[2]}")
```

### Type-Safe Validation

Pydantic や Dataclass と連携し、テーブルデータを構造化データとしてバリデーションできます。

```python
from pydantic import BaseModel

class FeatureComparison(BaseModel):
    feature: str
    excel: str
    markdown_suite: str
    notes: str | None = None

# バリデーション付きでロード
models = table.to_models(FeatureComparison)
```

# Tables

## Comparison

### Excel vs MD Suite

Markdown Spreadsheet Suite と一般的なスプレッドシート（Excel）の機能比較です。

| Feature | Excel | Markdown Suite | Notes |
| --- | --- | --- | --- |
| **Data Storage** | Binary (.xlsx) | Plain Text (.md) | Gitでの差分管理が容易。Webでもそのまま閲覧可能。 |
| **Grid UI** | Native App | VS Code Webview | 軽量で開発環境に統合されている。 |
| **Formulas** | In-Cell (`=A1+B1`) | Metadata-Based | 「データ」と「ロジック」を分離。Markdownを汚さない。 |
| **Formatting** | Rich (Fonts, Colors) | Semantic (Markdown) | 見た目はビューアに依存するが、意味論的なマークアップが可能。 |
| **Validation** | Data Validation | Schema (Python) | Pydantic等を用いた強力な型チェックが可能。 |
| **Automation** | VBA / Macros | Python Scripting | `uv` エコシステムやPandasを直接活用可能。 |
| **Version Control** | Difficult (Binary) | Native (Git) | PRレビューが可能。コンフリクト解消も容易。 |

<!-- md-spreadsheet-metadata: {"columnWidths": [120, 150, 150, 250], "column_widths": {"3": 203, "2": 140}} -->

### Keyboard Shortcuts

Excelユーザーが直感的に操作できるキーボードショートカット一覧です。

| Action | Windows/Linux | macOS | Context |
| --- | --- | --- | --- |
| **Undo** | `Ctrl+Z` | `Cmd+Z` | Global |
| **Redo** | `Ctrl+Y` | `Cmd+Shift+Z` | Global |
| **Bold** | `Ctrl+B` | `Cmd+B` | Format |
| **Italic** | `Ctrl+I` | `Cmd+I` | Format |
| **Link** | `Ctrl+K` | `Cmd+K` | Format |
| **Edit Cell** | `F2` | `F2` | Grid |
| **Select All** | `Ctrl+A` | `Cmd+A` | Grid |
| **Find** | `Ctrl+F` | `Cmd+F` | Grid |

<!-- md-spreadsheet-metadata: {"columnWidths": [120, 150, 150, 100], "column_widths": {"1": 154, "3": 74}} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "split", "id": "bj8Sel_MhOaOgSSPa37Az", "direction": "horizontal", "sizes": [54.6875, 45.3125], "children": [{"type": "pane", "id": "root", "tables": [0], "activeTableIndex": 0}, {"type": "pane", "id": "IoTJSjtjfMDHHr7_gUszt", "tables": [1], "activeTableIndex": 0}]}} -->

## Project Status

### Test Execution Report

架空のテスト実行レポートデータです。条件付き書式や集計のテストに使用できます。

| Module | Total Cases | Passed | Failed | Skipped | Coverage | Status |
| --- | --- | --- | --- | --- | --- | :---: |
| **Core Parsing Engine** | 150 | 150 | 0 | 0 | 98.5% | ✅ Stable |
| **Type Validation** | 65 | 62 | 3 | 0 | 92.0% | ⚠️ Review |
| **Webview Controller** | 80 | 78 | 2 | 0 | 88.5% | ✅ Stable |
| **Formula Engine** | 45 | 30 | 10 | 5 | 70.0% | 🚧 WIP |
| **I18N Support** | 25 | 25 | 0 | 0 | 100% | ✅ Stable |
| **Undo/Redo System** | 40 | 40 | 0 | 0 | 95.0% | ✅ Stable |
| **Performance (10k rows)** | 10 | 8 | 1 | 1 | - | ⚠️ Perf |

<!-- md-spreadsheet-metadata: {"columnWidths": [160, 100, 80, 80, 80, 80, 100]} -->

### Resource Allocation

プロジェクトメンバーの割り当て状況です。

| Member | Role | Core Parsing | Webview UI | Testing | Load |
| --- | --- | --- | --- | --- | --- |
| **Alice** | Lead | 40% | 10% | 10% | 60% |
| **Bob** | Backend | 80% | 0% | 20% | 100% |
| **Charlie** | Frontend | 0% | 90% | 10% | 100% |
| **Dave** | QA | 20% | 20% | 60% | 100% |
| **Eve** | Design | 0% | 50% | 0% | 50% |

<!-- md-spreadsheet-metadata: {"columnWidths": [100, 100, 100, 100, 100, 80]} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "split", "id": "XoegvbgWzHkA8HXN-DI7F", "direction": "vertical", "sizes": [36.52849740932643, 63.47150259067357], "children": [{"type": "pane", "id": "root", "tables": [1], "activeTableIndex": 0}, {"type": "pane", "id": "mMCHOT36H8iX8s-byozmB", "tables": [0], "activeTableIndex": 0}]}} -->

## Sales Data

### Q1 Regional Sales

データ型（日付、数値、通貨）のパーステスト用データです。

| Date | Region | Product | Quantity | Unit Price | Total |
| --- | --- | --- | --- | --- | --- |
| 2024-02-01 | US-North | Enterprise | 1 | $1,500 | $1,500 |
| 2024-01-16 | JP-West | Pro License | 2 | $300 | $600 |
| 2024-03-05 | JP-East | Support Add-on | 3 | $50 | $150 |
| 2024-01-15 | JP-East | Standard License | 5 | $100 | $500 |
| 2024-03-20 | US-West | Pro License | 5 | $300 | $1,500 |
| 2024-02-10 | EU-Central | Standard License | 10 | $100 | $1,000 |

<!-- md-spreadsheet-metadata: {"columnWidths": [100, 100, 150, 80, 100, 100], "column_widths": {"5": 80}} -->

### Q2 Forecast

第2四半期の売上予測データです。

| Month | Region | Growth Target | Expected Revenue | Risk Factor | Probability |
| --- | --- | --- | --- | --- | --- |
| **April** | Global | +5% | $15,000 | Low | 90% |
| **May** | JP-Region | +10% | $8,000 | Medium | 70% |
| **June** | US-Region | +8% | $12,000 | High | 50% |
| **Total** | - | - | $35,000 | - | - |

<!-- md-spreadsheet-metadata: {"columnWidths": [100, 100, 120, 150, 100, 100], "column_widths": {"2": 130, "3": 164}} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "split", "id": "VZdoVuAp4BkC0IUeVll1Q", "direction": "vertical", "sizes": [44.315245478036175, 55.684754521963825], "children": [{"type": "pane", "id": "root", "tables": [0], "activeTableIndex": 0}, {"type": "pane", "id": "YAH8An6xc74WWoWVeZvs6", "tables": [1], "activeTableIndex": 0}]}} -->

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}, {"type": "sheet", "index": 1}, {"type": "sheet", "index": 2}]} -->


# Appendix

## Glossaries

- **Workbook**: A collection of Sheets, defined by a top-level header (default `# Tables`).
- **Sheet**: A tab within a Workbook, defined by a second-level header.
- **Table**: A Markdown grid within a Sheet.
- **Hybrid Notebook**: A file containing both standard documentation and spreadsheet data.
