import * as vscode from 'vscode';

export function getDefaultColumnNames(): [string, string, string] {
    const isJapanese = vscode.env.language.startsWith('ja');
    if (isJapanese) {
        return ['列名1', '列名2', '列名3'];
    }
    return ['Column 1', 'Column 2', 'Column 3'];
}
