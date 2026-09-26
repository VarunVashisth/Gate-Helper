import { describe, expect, it } from 'vitest';
import { ollamaStatusSchema, settingsPatchSchema } from '../../src/shared/contracts/api';

describe('shared IPC contracts', () => {
  it('accepts a safe partial settings update', () => {
    expect(settingsPatchSchema.parse({ sidebarCollapsed: true })).toEqual({ sidebarCollapsed: true });
  });

  it('rejects an invalid Ollama status state', () => {
    expect(() =>
      ollamaStatusSchema.parse({ state: 'connected', message: '', models: [], checkedAt: '' }),
    ).toThrow();
  });
});

