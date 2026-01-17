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

## 2.5 Code Style Rules

### Import Statements

**All imports must be placed at the top of the file.** Do not use dynamic `await import()` within functions. Use static imports at the file header.

```typescript
// ✅ CORRECT: Static imports at file top
import * as editor from '../../src/editor';
import { someFunction } from './utils';

// ❌ WRONG: Dynamic import inside function
async function example() {
    const editor = await import('../../src/editor'); // Don't do this!
}
```

## 3. Parser Package

The extension uses the `md-spreadsheet-parser` NPM package for Markdown parsing. This package is installed as a dependency and bundled with the extension.

## 4. Frontend Development (Webview)

### Testing
-   **Unit Tests (`vitest`)**:
    ```bash
    npm run test:webview
    ```
    Test UI components and editor services in isolation (`webview-ui/tests/`).

### Linting & Formatting

-   **Lint check**:
    ```bash
    npm run lint
    ```
    Runs ESLint with Prettier integration to check for code style issues.

-   **Auto-fix lint issues**:
    ```bash
    npm run lint -- --fix
    ```
    Automatically fixes formatting and simple lint errors.

> [!IMPORTANT]
> Always run `npm run lint -- --fix` before committing changes.

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

## 6.6 Undo Batching for Multi-Step Operations

When an operation involves multiple steps (e.g., cell edit + formula recalculation), they should be consolidated into a single Undo stack so that `Ctrl+Z` reverts everything at once.

### Implementation Pattern

```typescript
// In SpreadsheetService
private _performAction<T extends IUpdateSpec>(fn: () => T) {
    // Start batch BEFORE the action
    this.startBatch();
    try {
        const result = fn();
        if (result) this._postUpdateMessage(result);
        // Callback runs WITHIN the same batch
        this._onDataChanged?.();
    } catch (err) {
        console.error('Operation failed:', err);
    } finally {
        // End batch AFTER everything completes
        this.endBatch();
    }
}
```

### Key Points

1. **Caller manages the batch**: Operations like `updateRange` and `_performAction` call `startBatch()` before executing
2. **Callbacks use `withinBatch: true`**: The `recalculateAllFormulas` function accepts a `withinBatch` parameter to skip its own batch management
3. **Single `endBatch()` at the end**: All updates are collected and sent as one message to VS Code

### For New Operations

When adding new data-modifying operations:
1. Wrap the operation in `startBatch()`/`endBatch()`
2. Call `_onDataChanged?.()` inside the batch
3. Use `_performAction` helper when possible - it handles batching automatically

---

## 6.7 Deferred Save for Non-Undo Operations

Some UI state changes (like tab switching) should be persisted to the file but should **not** create undo entries. These use the **deferred save** architecture.

### Problem

When switching table tabs in split-pane layouts, the `activeTableIndex` is updated in sheet metadata. If saved immediately, each tab switch creates an undo entry, polluting the undo stack.

### Solution: Deferred Save Queue

Instead of saving immediately, tab switches queue their updates to be applied with the next actual file edit:

```
Tab Switch → 'sheet-metadata-deferred' event
    ↓
GlobalEventController → queueDeferredMetadataUpdate()
    ↓
SpreadsheetService._deferredMetadataUpdates (Map)
    ↓
Next actual edit → startBatch() → _applyDeferredUpdates()
    ↓
Deferred update included in same batch as actual edit
```

### Key Files

- `webview-ui/components/layout-container.ts` - Dispatches `sheet-metadata-deferred` for switch-tab
- `webview-ui/controllers/global-event-controller.ts` - Routes event to service
- `webview-ui/services/spreadsheet-service.ts` - Manages deferred queue

### When to Use This Pattern

Use deferred save when:
- The change should be saved to file eventually
- The change should NOT create an undo entry
- The change can wait until the next actual edit

Examples: tab selection, scroll position, expanded/collapsed states

---

## 6.8 Computed Column Recalculation

Computed columns (formula columns defined in table metadata) are automatically recalculated after any data-modifying operation.

### Architecture

```
Data Operation → onDataChanged callback → recalculateAllFormulas()
                                                    ↓
                                          getCurrentWorkbook() from editor
                                                    ↓
                                          Evaluate all formulas (Lookup → Arithmetic)
                                                    ↓
                                          Compare with current values
                                                    ↓
                                          Sync changed cells via updateRangeBatch()
```

### Key Files

- `webview-ui/services/formula-recalculator.ts` - Core recalculation logic
- `webview-ui/services/spreadsheet-service.ts` - `getCurrentWorkbook()` and callback registration
- `webview-ui/main.ts` - Callback registration in `connectedCallback()`

### Troubleshooting: Recalculation Not Working

If formula columns are not updating after data changes, check these common causes:

#### 1. Stale Workbook Data
**Symptom**: Values don't change after column/row deletion or structural changes
**Cause**: Using `this.workbook` instead of fresh editor state
**Solution**: Use `getCurrentWorkbook()` to get fresh state from editor:
```typescript
this.spreadsheetService.setOnDataChangedCallback(() => {
    const currentWorkbook = this.spreadsheetService.getCurrentWorkbook();
    recalculateAllFormulas(currentWorkbook, ...);
});
```

#### 2. Callback Not Registered
**Symptom**: No recalculation after any operation
**Check**: Verify callback is registered in `connectedCallback()`:
```typescript
this.spreadsheetService.setOnDataChangedCallback(() => { ... });
```

#### 3. Operation Not Calling Callback
**Symptom**: Some operations don't trigger recalculation
**Cause**: Operation doesn't call `_onDataChanged?.()` or uses `_enqueueRequest` instead of `_performAction`
**Solution**: Ensure all data-modifying operations call `_onDataChanged?.()` after completing

#### 4. `withinBatch` Mismatch
**Symptom**: Batch errors or missing updates
**Cause**: Caller uses batch but passes `withinBatch: false`, or vice versa
**Solution**: Match `withinBatch` parameter to whether caller manages batch

#### 5. Change Detection Not Finding Updates
**Symptom**: Recalculation runs but `updates found: 0`
**Check**: Possible causes:
- Formula evaluates to same value as before
- Referenced column name changed but formula uses old name
- Workbook data is stale (see #1)

### Debug Tips

Add temporary logs to trace the flow:
```typescript
console.log('[DEBUG] recalculateAllFormulas: updates found:', updates.length);
console.log('[DEBUG] evaluateTask row 0: currentValue:', currentValue, 'newValue:', newValue);
```

---

## 7. For Maintainers

This section describes the release procedure for publishing a new version.

### 7.1 Pre-Release Checklist

- [ ] All changes are tested and working correctly.
- [ ] All tests pass (`npm test` and `npm run test:webview`).
- [ ] Extension packages successfully (`vsce package`).

### 7.1.1 Commit Policy for Bug Fixes

> [!CAUTION]
> **Do NOT commit bug fixes until UI verification is complete.**

For bug fixes that affect user-visible behavior:

1. **Write failing test** that reproduces the bug
2. **Implement the fix** to make the test pass
3. **Run full test suite** (`npm run test:webview`)
4. **Notify user for UI verification** - DO NOT COMMIT YET
5. **User confirms fix works** in actual extension
6. **Then commit** with descriptive message

This prevents committing fixes that pass tests but fail in real UI.

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
