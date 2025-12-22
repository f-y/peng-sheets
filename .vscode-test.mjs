import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    // Test files must be specified as compiled JavaScript ('out' directory), not TypeScript source.
    // The VS Code Extension Host executes the compiled code directly.
    files: 'out/test/**/*.test.js',

    mocha: {
        // The 'tdd' UI (suite/test) is the standard convention for VS Code extension tests,
        // mirroring the style used in the official VS Code codebase and examples.
        ui: 'tdd',

        // Increased timeout to 20 seconds (default is 2s).
        // VS Code extension tests require launching a VS Code instance and activating the extension,
        // which often takes significant time, especially on the first run or in CI environments.
        timeout: 20000
    }
});
