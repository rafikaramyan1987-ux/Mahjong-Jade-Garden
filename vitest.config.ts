import { defineConfig } from 'vitest/config';
export default defineConfig({
  define: { __PLATFORM__: JSON.stringify('web'), __GD_GAME_ID__: JSON.stringify('TODO_GD_GAME_ID') },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 120000 },
});
