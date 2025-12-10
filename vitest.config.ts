
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['**/*.test.ts'],
        setupFiles: ['./test-setup.ts'],
        deps: {
            inline: [/lit-element/, /lit-html/]
        }
    },
});
