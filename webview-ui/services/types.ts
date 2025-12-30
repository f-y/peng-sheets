export interface IPyodideFS {
    mkdir(path: string): void;
    mount(type: { [key: string]: unknown }, opts: Record<string, unknown>, mountpoint: string): void;
    syncfs(populate: boolean, callback: (err?: Error) => void): void;
    readFile(path: string, opts?: { encoding?: string }): string;
    analyzePath(path: string): { exists: boolean };
    filesystems: { IDBFS: { [key: string]: unknown } };
    // Additional FS methods for cache management
    stat(path: string): { mode: number };
    isDir(mode: number): boolean;
    readdir(path: string): string[];
    rmdir(path: string): void;
    unlink(path: string): void;
}

export interface IPyodide {
    runPythonAsync(code: string): Promise<string>;
    loadPackage(names: string | string[]): Promise<void>;
    pyimport(name: string): unknown;
    globals: Map<string, unknown>;
    FS?: IPyodideFS;
}

export interface IVSCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

export interface IUpdateSpec {
    type?: 'updateRange';
    error?: string;
    startLine?: number;
    endLine?: number;
    endCol?: number;
    content?: string;
    // Additional fields that might be returned
    [key: string]: unknown;
}

import type { VisualMetadata } from '../types/metadata';

export type IVisualMetadata = VisualMetadata;
