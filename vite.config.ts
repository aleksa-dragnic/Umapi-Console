import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The React Compiler is enabled - see docs/adr/0002-react-compiler-enabled.md.
// Manual memoisation is a defect in this codebase, not an optimisation.
export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Vitest's default include also matches e2e/*.spec.ts, which are Playwright
    // specs and cannot run under Vitest. Unit tests live in src and nowhere else.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // Application code only: not the tests, the mock, the entry point that
      // starts it, or the development-only specimen route.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/lib/testing/**',
        'src/setupTests.ts',
        'src/main.tsx',
        'src/app/design/**',
      ],
      // Two points under what was measured when the floor was set (96.2, 85.8,
      // 95.7, 96.7): a drop fails the build, a gain does not move it.
      thresholds: { statements: 94, branches: 83, functions: 93, lines: 94 },
    },
  },
});
