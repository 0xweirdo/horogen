import { describe, expect, it } from 'vitest';

import { createProjectSchema, PROJECT_TITLE_MAX, updateProjectSchema } from './projects.js';

describe('createProjectSchema', () => {
  it('trims title and defaults scriptConfig to {}', () => {
    const parsed = createProjectSchema.parse({ title: '  วิดีโอแรก  ' });
    expect(parsed.title).toBe('วิดีโอแรก');
    expect(parsed.scriptConfig).toEqual({});
  });

  it('rejects empty / whitespace-only title', () => {
    expect(() => createProjectSchema.parse({ title: '' })).toThrow();
    expect(() => createProjectSchema.parse({ title: '   ' })).toThrow();
  });

  it('rejects title longer than max', () => {
    expect(() => createProjectSchema.parse({ title: 'x'.repeat(PROJECT_TITLE_MAX + 1) })).toThrow();
  });
});

describe('updateProjectSchema', () => {
  it('accepts partial update', () => {
    expect(updateProjectSchema.parse({ title: 'ใหม่' })).toEqual({ title: 'ใหม่' });
  });

  it('rejects empty body', () => {
    expect(() => updateProjectSchema.parse({})).toThrow();
  });
});
