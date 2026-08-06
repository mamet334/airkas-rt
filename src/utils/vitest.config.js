// src/utils/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/billingEngine.test.js', '**/cycleEngine.test.js']
  }
});