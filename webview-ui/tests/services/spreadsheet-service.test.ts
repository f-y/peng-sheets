import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetService } from '../../services/spreadsheet-service';
import { IVSCodeApi, IPyodide } from '../../services/types';

describe('SpreadsheetService', () => {
    let service: SpreadsheetService;
    let mockVscode: IVSCodeApi;
    let mockPyodide: IPyodide;

    beforeEach(async () => {
        mockVscode = {
            postMessage: vi.fn(),
            getState: vi.fn(),
            setState: vi.fn()
        };

        mockPyodide = {
            runPythonAsync: vi.fn(),
            loadPackage: vi.fn(),
            pyimport: vi.fn(),
            globals: new Map(),
            FS: undefined
        };

        // Mock global loadPyodide
        (globalThis as any).loadPyodide = vi.fn().mockResolvedValue(mockPyodide);

        // Mock window properties used in initialize
        vi.stubGlobal('window', {
            pyodideIndexUrl: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
            wheelUri: undefined,
            vscodeLanguage: 'en'
        });

        service = new SpreadsheetService(mockVscode);
        await service.initialize();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('should call addTable with correct python code', async () => {
        // Setup mock return
        (mockPyodide.runPythonAsync as any).mockResolvedValue(JSON.stringify({ type: 'updateRange', startLine: 0 }));

        service.addTable(0, 'New Table');

        // Wait for queue processing (it uses setTimeout 0)
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify runPythonAsync call
        // Expect: res = api.add_table(0, ["Column 1","Column 2","Column 3"])\n                json.dumps(res) if res else "null"
        // Expect: res = api.add_table(json.loads("0"), ...)\n        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('api.add_table(json.loads("0")'));
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('Column 1'));

        // Verify postMessage
        expect(mockVscode.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'updateRange',
                startLine: 0
            })
        );
    });

    it('should call updateTableMetadata with correct python code', async () => {
        (mockPyodide.runPythonAsync as any).mockResolvedValue(JSON.stringify({ type: 'updateRange', startLine: 10 }));

        service.updateTableMetadata(0, 1, 'My Table', 'My Desc');

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('api.update_table_metadata('));
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('json.loads("0"),')); // sheetIdx
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('json.loads("1"),')); // tableIdx
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('My Table'));
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('My Desc'));
    });

    it('should call deleteDocument using atomic update function', async () => {
        // Setup mock return for full file update
        const mockUpdate = {
            content: 'new content',
            startLine: 0,
            endLine: 100,
            file_changed: true,
            structure: {}
        };
        (mockPyodide.runPythonAsync as any).mockResolvedValue(JSON.stringify(mockUpdate));

        service.deleteDocument(1);

        // Wait for queue
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify correct Python function used
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(
            expect.stringContaining('api.delete_document_and_get_full_update(')
        );
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('json.loads("1")'));

        // Verify single message posted (not batch)
        expect(mockVscode.postMessage).toHaveBeenCalledTimes(1);
        expect(mockVscode.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'new content',
                startLine: 0,
                endLine: 100
            })
        );
        // Verify it is NOT an array (batch)
        const callArgs = (mockVscode.postMessage as any).mock.calls[0][0];
        expect(Array.isArray(callArgs)).toBe(false);
    });

    it('should use md_spreadsheet_editor.api for operations', async () => {
        (mockPyodide.runPythonAsync as any).mockResolvedValue(JSON.stringify({}));

        service.updateTableMetadata(0, 1, 'My Table', 'My Desc');

        await new Promise((resolve) => setTimeout(resolve, 10));

        // Should use api prefix
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('api.update_table_metadata('));
    });

    it('should initialize using api', async () => {
        (mockPyodide.runPythonAsync as any).mockResolvedValue(JSON.stringify({}));

        await service.initializeWorkbook('# Test', {});

        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(
            expect.stringContaining('api.initialize_workbook(md_text, config)')
        );
    });
});
