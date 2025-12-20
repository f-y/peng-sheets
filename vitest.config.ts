
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['**/*.test.ts'],
        setupFiles: ['./test-setup.ts'],
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: false,
                isolate: true,
            }
        },
        deps: {
            inline: [/lit-element/, /lit-html/]
        }
    },
});
