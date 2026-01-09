# Development Guide (Full Stack)


> [!NOTE] 
> Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before starting development.

This document outlines the development practices for the `PengSheets` extension, covering the Extension Host (Node.js) and Webview (Lit).

## 1. Architecture Overview

```mermaid
graph TD
    EXT[Extension Host (Node)] <-->|Messages| WB[Webview (HTML/Lit)]
    WB <-->|TypeScript Editor| WASM[md-spreadsheet-parser (WASM)]
```

-   **Extension Host**: Handles file I/O, VS Code API, and Undo/Redo stack.
-   **Webview**: Renders the UI and hosts the TypeScript editor logic.
-   **md-spreadsheet-parser**: NPM package providing Markdown table parsing via WASM.

## 2. Directory Structure

-   `src/`: Extension Host (Node.js) code.
-   `src/editor/`: TypeScript editor services (ported from Python).
-   `webview-ui/`: Frontend (Lit) code.
-   `webview-ui/tests/`: Vitest tests for webview and editor.

## 3. Parser Package

The extension uses the `md-spreadsheet-parser` NPM package for Markdown parsing. This package is installed as a dependency and bundled with the extension.

## 4. Frontend Development (Webview)

### Testing
-   **Unit Tests (`vitest`)**:
    ```bash
    npm run test:webview
    ```
    Test UI components and editor services in isolation (`webview-ui/tests/`).

### Internationalization (i18n)
-   Use `t('key')`.
-   Update `webview-ui/utils/i18n.ts`.

## 5. Extension Development (Node.js)

### Running Integration Tests
```bash
npm test
```
Runs the extension in a real VS Code instance.

### Coverage
```bash
npm run test:coverage
```
Collects coverage for the TypeScript extension code using `c8`.

## 6. Build & Release

To package the full extension (`.vsix`):

```bash
vsce package
```

### Publishing to Marketplace

1.  **Bump Version**:
    ```bash
    npm version patch # or minor/major
    ```

2.  **Publish to VS Code Marketplace**:
    ```bash
    vsce publish
    ```

3.  **Publish to Open VSX Registry**:
    ```bash
    # Requires 'ovsx' CLI: npm install -g ovsx
    ovsx publish peng-sheets-x.x.x.vsix -p <OPEN_VSX_TOKEN>
    ```
