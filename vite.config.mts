import { defineConfig } from "vite";
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/pyodide/pyodide.js',
                    dest: 'pyodide'
                },
                {
                    src: 'node_modules/pyodide/pyodide.asm.js',
                    dest: 'pyodide'
                },
                {
                    src: 'node_modules/pyodide/pyodide.asm.wasm',
                    dest: 'pyodide'
                },
                {
                    src: 'node_modules/pyodide/python_stdlib.zip',
                    dest: 'pyodide'
                },
                {
                    src: 'node_modules/pyodide/package.json',
                    dest: 'pyodide'
                },
                {
                    src: 'node_modules/pyodide/pyodide-lock.json',
                    dest: 'pyodide'
                },
                {
                    src: 'resources/pyodide_pkgs/*.whl',
                    dest: 'pyodide'
                }
            ]
        })
    ],
    build: {
        outDir: "out/webview",
        rollupOptions: {
            input: {
                main: "./webview-ui/index.html",
            },
            output: {
                entryFileNames: `[name].js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`,
            },
        },
    },
    publicDir: "resources",
    server: {
        port: 5173,
        strictPort: true,
        cors: true,
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        }
    },
});
