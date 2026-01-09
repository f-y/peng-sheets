#!/usr/bin/env node
/* eslint-env node */
/**
 * Publish script for PengSheets extension.
 *
 * This script publishes the extension to:
 * - VS Code Marketplace (via vsce)
 * - Open VSX Registry (via ovsx)
 *
 * Usage:
 *   node scripts/publish.mjs [options]
 *
 * Options:
 *   --vsce-only    Publish to VS Code Marketplace only
 *   --ovsx-only    Publish to Open VSX Registry only
 *   --dry-run      Show what would be done without publishing
 *
 * Environment Variables (from .env or shell):
 *   OPEN_VSX_TOKEN  Token for Open VSX Registry
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const vsceOnly = args.includes('--vsce-only');
const ovsxOnly = args.includes('--ovsx-only');
const dryRun = args.includes('--dry-run');

/**
 * Load environment variables from .env files.
 * Checks both peng-sheets/.env and root .env
 */
function loadEnv() {
    const envPaths = [join(rootDir, '.env'), join(rootDir, '..', '.env')];

    for (const envPath of envPaths) {
        if (existsSync(envPath)) {
            const content = readFileSync(envPath, 'utf-8');
            for (const line of content.split('\n')) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                    if (key && value && !process.env[key]) {
                        process.env[key] = value;
                    }
                }
            }
        }
    }
}

/**
 * Get the current package version.
 */
function getVersion() {
    const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
    return packageJson.version;
}

/**
 * Run a command and print output.
 */
function run(cmd, options = {}) {
    console.log(`\n$ ${cmd}`);
    if (dryRun) {
        console.log('  (dry-run: skipped)');
        return;
    }
    try {
        execSync(cmd, { stdio: 'inherit', cwd: rootDir, ...options });
    } catch (error) {
        console.error(`Command failed: ${cmd}`);
        process.exit(1);
    }
}

/**
 * Publish to VS Code Marketplace.
 */
function publishVsce() {
    console.log('\n📦 Publishing to VS Code Marketplace...');
    run('vsce publish');
}

/**
 * Publish to Open VSX Registry.
 */
function publishOvsx() {
    const token = process.env.OPEN_VSX_TOKEN;
    if (!token && !dryRun) {
        console.error('\n❌ Error: OPEN_VSX_TOKEN is not set.');
        console.error('   Set it in .env file or as environment variable.');
        process.exit(1);
    }
    if (!token && dryRun) {
        console.warn('\n⚠️  Warning: OPEN_VSX_TOKEN is not set (ignored in dry-run mode).');
    }

    const version = getVersion();
    const vsixFile = `peng-sheets-${version}.vsix`;
    const vsixPath = join(rootDir, vsixFile);

    if (!existsSync(vsixPath) && !dryRun) {
        console.error(`\n❌ Error: ${vsixFile} not found.`);
        console.error('   Run "vsce package" first to create the .vsix file.');
        process.exit(1);
    }

    console.log('\n📦 Publishing to Open VSX Registry...');
    run(`ovsx publish ${vsixFile} -p ${dryRun ? '<TOKEN>' : token}`);
}

// Main execution
console.log('🚀 PengSheets Publish Script');
console.log('============================');

loadEnv();

const version = getVersion();
console.log(`\nVersion: ${version}`);

if (dryRun) {
    console.log('Mode: DRY RUN (no actual publishing)');
}

if (!vsceOnly && !ovsxOnly) {
    // Publish to both
    publishVsce();
    publishOvsx();
} else if (vsceOnly) {
    publishVsce();
} else if (ovsxOnly) {
    publishOvsx();
}

console.log('\n✅ Done!');
