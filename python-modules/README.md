# MD Spreadsheet Editor (Python Core)

The `md_spreadsheet_editor` package implements the core logic for the **Markdown Spreadsheet** VS Code extension. It is designed to run within a **Pyodide** (WebAssembly) environment inside the VS Code Webview.

## Architecture

This package provides the business logic for manipulating Markdown tables as spreadsheets. It is separated into:

-   **Headless Editor (`headless_editor.py`)**: The legacy entry point / Shim layer that exposes flat API functions to JavaScript.
-   **Services (`src/md_spreadsheet_editor/services/`)**: The core logic (e.g., `SheetService`, `DocumentService`) responsible for structural changes.
-   **Context (`src/md_spreadsheet_editor/context.py`)**: Manages the global state (Workbook, Markdown text) for the session.

## Development

Please refer to [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed instructions on:

-   Setting up the `uv` environment.
-   Running tests (`pytest`).
-   Building the Wheel package (`uv build`).
-   Strict Coverage Policy.
