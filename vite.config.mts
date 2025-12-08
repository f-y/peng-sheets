import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
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
    },
});
