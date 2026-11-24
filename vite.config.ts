import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * MSW's worker lives in `public/` so the dev server and the `e2e` build serve
 * it, but Vite copies `public/` into every build. A production build never
 * registers it, so it goes: nothing the mock needs is deployed (gate 2).
 */
function mockWorkerOnlyWhereTheMockRuns(mode: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'mock-worker-only-where-the-mock-runs',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (mode !== 'e2e') rmSync(resolve(outDir, 'mockServiceWorker.js'), { force: true });
    },
  };
}

// The React Compiler is enabled - see docs/adr/0002-react-compiler-enabled.md.
// Manual memoisation is a defect in this codebase, not an optimisation.
export default defineConfig(({ mode }) => ({
  plugins: [react({ compiler: true }), tailwindcss(), mockWorkerOnlyWhereTheMockRuns(mode)],
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
}));
