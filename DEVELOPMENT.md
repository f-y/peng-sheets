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

---

## 6.5 Optimistic Update and isSyncing Pattern

When the user edits cells (delete, paste, type, etc.), the webview uses **Optimistic Update** to provide immediate feedback:

1. **UI updates immediately** (e.g., `table.rows[r][c] = ''`)
2. Change event is dispatched (e.g., `range-edit`)
3. `SpreadsheetService` sends update to VS Code extension
4. VS Code updates the document and sends new content back

### The Problem

Without proper handling, the VS Code response triggers `_parseWorkbook()`, which:
- Re-parses the entire workbook from markdown
- Replaces `this.workbook` with the parsed data
- This can cause **visual flicker** because the re-parse momentarily shows data that doesn't match the optimistic update

### The Solution: `isSyncing` Flag

The `SpreadsheetService` exposes an `isSyncing` getter:

```typescript
// spreadsheet-service.ts
public get isSyncing(): boolean {
    return this._isSyncing;
}
```

When `isSyncing` is `true`, the service is waiting for VS Code's response to our own change.

In `GlobalEventController._handleMessage`, we skip `_parseWorkbook()` during sync:

```typescript
if (this.host.spreadsheetService.isSyncing) {
    // Skip re-parse - optimistic update is already correct
    this.host.spreadsheetService.notifyUpdateReceived();
} else {
    await this.host._parseWorkbook();
    this.host.spreadsheetService.notifyUpdateReceived();
}
```

### When to Use This Pattern

Use `isSyncing` check when:
- Receiving external updates that might conflict with optimistic UI changes
- Implementing new edit operations that update UI before server confirmation

---

## 7. For Maintainers

This section describes the release procedure for publishing a new version.

### 7.1 Pre-Release Checklist

- [ ] All changes are tested and working correctly.
- [ ] All tests pass (`npm test` and `npm run test:webview`).
- [ ] Extension packages successfully (`vsce package`).

### 7.2 Update CHANGELOG.md

1.  **Move `[Unreleased]` entries to the new version section**:
    -   Change `## [Unreleased]` heading to `## [X.Y.Z] - YYYY-MM-DD`.
    -   Add a new empty `## [Unreleased]` section above it.

2.  **Categorize changes using these headings**:
    -   `### Added` - New features.
    -   `### Changed` - Changes in existing functionality.
    -   `### Fixed` - Bug fixes.
    -   `### Removed` - Removed features.
    -   `### Improved` - Performance or UX improvements.

3.  **Example**:
    ```markdown
    ## [Unreleased]

    ## [1.0.4] - 2026-01-15

    ### Added
    - New feature description.

    ### Fixed
    - Bug fix description.
    ```

### 7.3 Version Bump & Git Tag

1.  **Bump version in `package.json`**:
    ```bash
    npm version patch  # or minor / major
    ```
    This automatically:
    -   Updates `version` in `package.json`.
    -   Creates a git commit with message `vX.Y.Z`.
    -   Creates a git tag `vX.Y.Z`.

2.  **Push the commit and tag**:
    ```bash
    git push origin main
    git push origin vX.Y.Z
    ```

### 7.4 Create GitHub Release

1.  Go to the repository's **Releases** page on GitHub.
2.  Click **"Draft a new release"**.
3.  Select the tag `vX.Y.Z` you just pushed.
4.  Set the release title to `vX.Y.Z` (e.g., `v1.0.4`).
5.  Copy the relevant section from `CHANGELOG.md` into the release description.
6.  Attach the `.vsix` file (`peng-sheets-X.Y.Z.vsix`) as a release asset.
7.  Click **"Publish release"**.

### 7.5 Publish Extension

After creating the GitHub release, publish the extension to marketplaces.

#### Using the Publish Script (Recommended)

1.  **Set up `.env`** (in project root or `peng-sheets/`):
    ```bash
    OPEN_VSX_TOKEN=your_open_vsx_token_here
    ```

2.  **Run the publish script**:
    ```bash
    node scripts/publish.mjs
    ```

**Options**:
-   `--vsce-only` - Publish to VS Code Marketplace only.
-   `--ovsx-only` - Publish to Open VSX Registry only.
-   `--dry-run` - Preview what would be done without publishing.

#### Manual Publishing

```bash
# VS Code Marketplace
vsce publish

# Open VSX Registry
ovsx publish peng-sheets-X.Y.Z.vsix -p <OPEN_VSX_TOKEN>
```

### 7.6 Post-Release Verification

- [ ] Verify the extension is visible on [VS Code Marketplace](https://marketplace.visualstudio.com/).
- [ ] Verify the GitHub Release page shows the correct assets and notes.
- [ ] Install from marketplace in a fresh VS Code instance to confirm it works.
