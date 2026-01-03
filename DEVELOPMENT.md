# Development Guide (Full Stack)


> [!NOTE] 
> Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before starting development.

This document outlines the development practices for the `PengSheets` extension, covering the Extension Host (Node.js), Webview (Lit), and the Python Kernel (Pyodide).

## 1. Architecture Overview

```mermaid
graph TD
    EXT[Extension Host (Node)] <-->|Messages| WB[Webview (HTML/Lit)]
    WB <-->|Pyodide Bridge| WASM[Pyodide (WASM)]
    WASM -->|Loads| WHL[md_spreadsheet_editor.whl (Python)]
```

-   **Extension Host**: Handles file I/O, VS Code API, and Undo/Redo stack.
-   **Webview**: Renders the UI and hosts the Pyodide runtime.
-   **Pyodide**: Executes the core business logic provided by the `python-modules` package.

## 2. Directory Structure

-   `src/`: Extension Host (Node.js) code.
-   `webview-ui/`: Frontend (Lit) code.
-   `python-modules/`: Core Python business logic (Separate project).
-   `resources/pyodide_pkgs/`: Directory where Python wheels are bundled.

## 3. Python Integration & Workflow

The extension runs Python logic locally via Pyodide.

### Architecture
-   **Bundled Pyodide**: We bundle a local version of Pyodide for offline support and speed.
-   **Wheels**: The core logic is defined in `python-modules/` and built into a `.whl` file.

### Modifying Python Logic
**CRITICAL**: Pyodide caches packages by version. To update Python logic, you **MUST bump the version**.

1.  **Modify & Test**:
    ```bash
    cd python-modules
    # Edit code...
    uv run pytest
    ```
2.  **Bump Version**:
    Update `version` in `python-modules/pyproject.toml`.
3.  **Build Wheel**:
    ```bash
    uv build
    ```
4.  **Install Wheel** (Copy to Extension):
    Copy the generated `.whl` file from `python-modules/dist/` to `webview-ui/resources/pyodide_pkgs/`.
    *(Ensure you delete old versions of the wheel to avoid confusion)*.

## 4. Frontend Development (Webview)

### Testing
-   **Unit Tests (`vitest`)**:
    ```bash
    npm run test:webview
    ```
    Test UI components in isolation (`webview-ui/tests/`).

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
Ensure all Python wheels are correctly placed in `resources/pyodide_pkgs/` before packaging.

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
