import { defineConfig } from 'vitest/config';
export default defineConfig({
  define: { __PLATFORM__: JSON.stringify('web'), __GD_GAME_ID__: JSON.stringify('2708776451364ee68eca7c869f5371e0') },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 120000 },
});
