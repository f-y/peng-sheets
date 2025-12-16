const translations = {
    en: {
        renameSheet: 'Rename Sheet',
        deleteSheet: 'Delete Sheet',
        deleteSheetConfirm: 'Are you sure you want to delete sheet "{0}"? This action cannot be undone.',
        cancel: 'Cancel',
        delete: 'Delete',
        addDescription: 'Add description...',
        description: 'Description',
        addTable: 'Add Table',
        table: 'Table {0}',
        noTableSelected: 'No Table Selected',
        loading: 'Loading...',
        initializing: 'Initializing Pyodide...',
        newTable: 'New Table',
        insertRowAbove: 'Insert Row Above',
        insertRowBelow: 'Insert Row Below',
        deleteRow: 'Delete Row',
        insertColLeft: 'Insert Column Left',
        insertColRight: 'Insert Column Right',
        deleteCol: 'Delete Column',
        clearCol: 'Clear Column',
        deleteTable: 'Delete Table',
        renameTable: 'Rename Table',
        noSpreadsheetFound: 'No Spreadsheet Found',
        noSpreadsheetMessage:
            'This document does not contain a workbook section yet. Create one to start editing tables.',
        createSpreadsheet: 'Create Spreadsheet',
        toolbarBold: 'Bold',
        toolbarItalic: 'Italic',
        toolbarAlignLeft: 'Align Left',
        toolbarAlignCenter: 'Align Center',
        toolbarAlignRight: 'Align Right',
        toolbarStrikethrough: 'Strikethrough'
    },
    ja: {
        renameSheet: 'シート名の変更',
        deleteSheet: 'シートを削除',
        deleteSheetConfirm: 'シート "{0}" を削除してもよろしいですか？この操作は取り消せません。',
        cancel: 'キャンセル',
        delete: '削除',
        addDescription: '説明を追加...',
        description: '説明',
        addTable: 'テーブルを追加',
        table: 'テーブル {0}',
        noTableSelected: 'テーブルが選択されていません',
        loading: '読み込み中...',
        initializing: 'Pyodideを初期化中...',
        newTable: '新しいテーブル',
        insertRowAbove: '上に行を挿入',
        insertRowBelow: '下に行を挿入',
        deleteRow: '行を削除',
        insertColLeft: '左に列を挿入',
        insertColRight: '右に列を挿入',
        deleteCol: '列を削除',
        clearCol: '列をクリア',
        deleteTable: 'テーブルを削除',
        renameTable: 'テーブル名の変更',
        noSpreadsheetFound: 'スプレッドシートが見つかりません',
        noSpreadsheetMessage:
            'このドキュメントにはまだワークブックセクションがありません。テーブル編集を開始するには作成してください。',
        createSpreadsheet: 'スプレッドシートを作成',
        toolbarBold: '太字',
        toolbarItalic: '斜体',
        toolbarAlignLeft: '左揃え',
        toolbarAlignCenter: '中央揃え',
        toolbarAlignRight: '右揃え',
        toolbarStrikethrough: '取り消し線'
    }
};

// Allow 'en' | 'ja' keys.
// We fallback to 'en' for any non-ja language for now.
export type I18nKey = keyof (typeof translations)['en'];

export function t(key: I18nKey, ...args: any[]): string {
    // Expect window.vscodeLanguage to be set by extension
    const lang = (window as any).vscodeLanguage || 'en';
    const locale = lang.startsWith('ja') ? 'ja' : 'en';

    let text = (translations as any)[locale]?.[key] || translations['en'][key] || key;

    args.forEach((arg, i) => {
        text = text.replace(`{${i}}`, arg);
    });
    return text;
}
