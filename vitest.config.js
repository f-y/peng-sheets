"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        environment: 'jsdom',
        include: ['**/*.test.ts'],
        setupFiles: ['./test-setup.ts'],
        deps: {
            inline: [/lit-element/, /lit-html/]
        }
    },
});
//# sourceMappingURL=vitest.config.js.map