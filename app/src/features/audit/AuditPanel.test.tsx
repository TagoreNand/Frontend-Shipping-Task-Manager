import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuditPanel } from './AuditPanel';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuditPanel', () => {
  it('lists audit entries from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [{ id: '1', at: '2025-06-01T00:00:00.000Z', actor: 'admin', action: 'user.create', target: 'ops' }],
      })),
    );
    render(<AuditPanel onClose={() => {}} />);
    expect(await screen.findByText('user.create')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
});
