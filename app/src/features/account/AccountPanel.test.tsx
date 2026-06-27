import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountPanel } from './AccountPanel';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountPanel', () => {
  it('confirms a successful password change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 204, json: async () => ({}) })),
    );
    render(<AccountPanel onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText('Current password'), 'old');
    await userEvent.type(screen.getByLabelText('New password'), 'newpass1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText('Password updated.')).toBeInTheDocument();
  });
});
