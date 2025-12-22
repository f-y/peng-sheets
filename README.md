# Markdown Spreadsheet Editor

<p align="center">
  <a href="https://github.com/f-y/vscode-md-spreadsheet/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  </a>
  <a href="https://github.com/f-y/vscode-md-spreadsheet">
    <img src="https://img.shields.io/badge/repository-github-green.svg" alt="Repository" />
  </a>
</p>

<p align="center">
  <strong>A powerful, spreadsheet-like interface for editing Markdown tables in VS Code.</strong>
</p>

---

**Markdown Spreadsheet Editor** transforms your Markdown tables into a rich, interactive spreadsheet view. Powered by [md-spreadsheet-parser](https://github.com/f-y/md-spreadsheet-parser) and **Pyodide**, it runs a robust Python parser directly in your editor, offering superior parsing accuracy and multi-sheet support.

## ✨ Features

- **📊 Spreadsheet View**: Visualize and navigate Markdown tables in a clean, grid-based interface.
- **📑 Multi-Sheet Support**: Organize your data with multiple sheets using H1 headers (`# Sheet Name`).
- **⚡ Live Updates**: Changes in the Markdown file are instantly reflected in the spreadsheet view.
- **🐍 Python-Powered Parsing**: Leverages a full-featured Python parser (via WebAssembly) for reliable handling of complex Markdown tables.
- **🛠️ Highly Configurable**: Customize header levels, description capturing, and more to fit your documentation style.

## 🚀 Usage

1.  Open any Markdown file (`.md`) containing tables.
2.  Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
3.  Run the command: **`Markdown Spreadsheet: Open Editor`**.
    - *Tip: You can also find this command in the editor title menu.*
4.  A new tab will open with the spreadsheet view.
5.  Edit your Markdown file, and watch the spreadsheet update in real-time!

## ⚙️ Extension Settings

This extension contributes the following settings:

| ID | Description | Default |
| :--- | :--- | :--- |
| `mdSpreadsheet.parsing.rootMarker` | The marker indicating the start of the data section. | `# Tables` |
| `mdSpreadsheet.parsing.sheetHeaderLevel` | The header level used to identify sheets (e.g., 2 for `## Sheet`). | `2` |
| `mdSpreadsheet.parsing.tableHeaderLevel` | The header level used to identify tables (e.g., 3 for `### Table`). | `3` |
| `mdSpreadsheet.parsing.captureDescription` | Capture text between the header and the table as a description. | `true` |
| `mdSpreadsheet.parsing.columnSeparator` | Character used to separate columns in the Markdown source. | `\|` |
| `mdSpreadsheet.parsing.headerSeparatorChar` | Character used in the separator row. | `-` |
| `mdSpreadsheet.parsing.requireOuterPipes` | Whether generated tables must have outer pipes. | `true` |
| `mdSpreadsheet.parsing.stripWhitespace` | Whether to strip whitespace from cell values. | `true` |

## 🔧 Architecture

This extension uses a hybrid architecture for maximum performance and compatibility:

- **Frontend**: Built with **Lit** and **VS Code Webview UI Toolkit** for a native look and feel.
- **Backend (In-Browser)**: Runs **Python 3.12** via **Pyodide** to execute the `md-spreadsheet-parser` library.
- **Communication**: Uses standard VS Code messaging API for seamless synchronization between the editor and the webview.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
