# Development Guide

This extension uses a hybrid architecture with a VS Code extension host (TypeScript) and a Webview UI (Lit + Vite), powered by a Python library (`md-spreadsheet-parser`) running in the browser via Pyodide.

## Architecture

- **Extension Host (`src/extension.ts`)**: Handles commands, file events, and Webview creation.
- **Webview UI (`webview-ui/`)**: A Single Page Application built with Lit and Vite.
- **Parser (`md-spreadsheet-parser`)**: A Python library that parses Markdown into a Workbook structure. It is built as a Wheel and loaded by Pyodide in the Webview.

## Prerequisites

- Node.js (v20+)
- Python (3.12+)
- `hatch` or `pip` (for building the Python package)

## Setup

1.  Install Node.js dependencies:
    ```bash
    npm install
    ```

2.  Build the Python parser wheel:
    ```bash
    cd ../md-spreadsheet-parser
    # Ensure you have a virtual environment and build tools
    python -m build
    ```

3.  Copy the built wheel to the extension's public directory:
    ```bash
    # From the root of the workspace
    cp md-spreadsheet-parser/dist/md_spreadsheet_parser-*.whl vscode-md-spreadsheet/public/
    ```

## Debugging (Hot Module Replacement)

For the best development experience, use Vite's HMR for the Webview UI.

1.  **Start the Vite Dev Server**:
    Open a terminal in `vscode-md-spreadsheet` and run:
    ```bash
    npm run dev
    ```
    This starts a local server at `http://localhost:5173`.

2.  **Start VS Code Debugging**:
    Press `F5` in VS Code.

    The extension detects the dev server and loads the Webview content from `localhost:5173`. Changes to `webview-ui/` files will be reflected immediately.

## Packaging

To build the extension for production (without the dev server dependency):

```bash
npm run compile
vsce package
```

This will bundle the Webview assets into `out/webview` and configure the extension to load them from disk.
