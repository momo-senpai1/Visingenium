import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // the robustness sweeps run thousands of solver calls; 5 s is too tight on a loaded machine
  test: { environment: 'node', testTimeout: 20_000 },
});
