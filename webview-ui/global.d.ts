/**
 * Type declarations for CSS imports in webview-ui
 */

// CSS file imports with ?inline suffix (Vite pattern)
declare module '*.css?inline' {
    const content: string;
    export default content;
}

// Regular CSS imports
declare module '*.css' {
    const content: string;
    export default content;
}
