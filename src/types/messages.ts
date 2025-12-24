export interface UpdateRangeMessage {
    type: 'updateRange';
    startLine: number;
    endLine: number;
    endCol?: number;
    content: string;
    undoStopBefore?: boolean;
    undoStopAfter?: boolean;
}

export interface UndoMessage {
    type: 'undo';
}

export interface RedoMessage {
    type: 'redo';
}

export interface CreateSpreadsheetMessage {
    type: 'createSpreadsheet';
}

export interface SaveMessage {
    type: 'save';
}

export interface UpdateOrConfigMessage {
    // Messages sent FROM extension TO webview, leaving here for completeness or future use if needed, but primarily we are defining From Webview types.
    type: 'update' | 'configUpdate';
    content?: string;
    config?: unknown;
}

export type WebviewMessage = UpdateRangeMessage | UndoMessage | RedoMessage | CreateSpreadsheetMessage | SaveMessage;
