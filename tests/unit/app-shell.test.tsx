import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../src/renderer/layouts/AppShell';

const apiMock = {
  settings: {
    get: vi.fn().mockResolvedValue({ selectedOllamaModel: null, sidebarCollapsed: false }),
    update: vi.fn().mockResolvedValue({ selectedOllamaModel: null, sidebarCollapsed: false }),
  },
  tutor: {
    getStatus: vi.fn().mockResolvedValue({
      state: 'unavailable',
      message: 'Ollama is not reachable on this computer.',
      models: [],
      checkedAt: new Date(0).toISOString(),
    }),
  },
};

describe('application shell', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'gateHelper', { configurable: true, value: apiMock });
  });

  it('renders every primary navigation destination', async () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    for (const label of ['Dashboard', 'Planner', 'Syllabus', 'Tests', 'Results', 'AI Tutor']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    await waitFor(() => expect(apiMock.tutor.getStatus).toHaveBeenCalled());
  });
});

