import { describe, expect, it } from 'vitest';

import { isTerminalStatus, JOB_STATUSES, jobPrioritySchema, jobStatusSchema } from './index.js';

describe('jobStatusSchema', () => {
  it.each(JOB_STATUSES)('accepts locked status %s', (status) => {
    expect(jobStatusSchema.parse(status)).toBe(status);
  });

  it('rejects status outside the locked state machine', () => {
    expect(() => jobStatusSchema.parse('RENDERING')).toThrow();
    expect(() => jobStatusSchema.parse('queued')).toThrow();
  });
});

describe('jobPrioritySchema', () => {
  it('accepts only standard | paid', () => {
    expect(jobPrioritySchema.parse('standard')).toBe('standard');
    expect(jobPrioritySchema.parse('paid')).toBe('paid');
    expect(() => jobPrioritySchema.parse('premium')).toThrow();
  });
});

describe('isTerminalStatus', () => {
  it('marks DONE/FAILED/CANCELLED as terminal', () => {
    expect(isTerminalStatus('DONE')).toBe(true);
    expect(isTerminalStatus('FAILED')).toBe(true);
    expect(isTerminalStatus('CANCELLED')).toBe(true);
  });

  it('marks in-flight statuses as non-terminal', () => {
    expect(isTerminalStatus('QUEUED')).toBe(false);
    expect(isTerminalStatus('TTS_RUNNING')).toBe(false);
    expect(isTerminalStatus('ANIMATING')).toBe(false);
    expect(isTerminalStatus('ENCODING')).toBe(false);
  });
});
