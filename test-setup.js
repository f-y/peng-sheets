"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vitest_1.vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vitest_1.vi.fn(), // deprecated
        removeListener: vitest_1.vi.fn(), // deprecated
        addEventListener: vitest_1.vi.fn(),
        removeEventListener: vitest_1.vi.fn(),
        dispatchEvent: vitest_1.vi.fn(),
    })),
});
//# sourceMappingURL=test-setup.js.map