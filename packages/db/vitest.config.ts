import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // integration tests แชร์ DB เดียวกัน — รันทีละไฟล์กัน race
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
