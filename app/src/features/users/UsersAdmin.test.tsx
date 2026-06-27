import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsersAdmin } from './UsersAdmin';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UsersAdmin', () => {
  it('lists users fetched from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [
          { id: '1', username: 'dispatcher', role: 'dispatcher', displayName: 'Demo Dispatcher' },
          { id: '2', username: 'admin', role: 'admin', displayName: 'Administrator' },
        ],
      })),
    );
    render(<UsersAdmin onClose={() => {}} />);
    expect(await screen.findByText('@dispatcher')).toBeInTheDocument();
    expect(screen.getByText('@admin')).toBeInTheDocument();
    expect(screen.getByLabelText('Role for admin')).toBeInTheDocument();
  });
});
