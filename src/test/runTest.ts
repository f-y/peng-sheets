import * as path from 'path';
import { runTests } from '@vscode/test-electron';
import * as fs from 'fs';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './index');

        // Coverage directory
        const coveragePath = path.resolve(__dirname, '../../coverage/tmp');

        // Clean coverage directory
        if (fs.existsSync(coveragePath)) {
            fs.rmSync(coveragePath, { recursive: true, force: true });
        }
        fs.mkdirSync(coveragePath, { recursive: true });

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            extensionTestsEnv: {
                NODE_V8_COVERAGE: coveragePath
            }
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
