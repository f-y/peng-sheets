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

        service = new SpreadsheetService('print("hello")', mockVscode);
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
        // Expect: res = add_table(0, ["Column 1","Column 2","Column 3"])\n                json.dumps(res) if res else "null"
        // Expect: res = add_table(json.loads("0"), ...)\n        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('add_table(json.loads("0")'));
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

        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('update_table_metadata('));
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('json.loads("0"),')); // sheetIdx
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('json.loads("1"),')); // tableIdx
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('My Table'));
        expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('My Desc'));
    });
});
