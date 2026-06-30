import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskQueue } from './RiskQueue';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RiskQueue', () => {
  it('lists flagged transactions with actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [
          { id: 't1', ref: 'AIR-2299', title: 'Aerospace', transaction: { id: 'TXN-1049', amount: 88000, currency: 'USD', customerStatus: 'processing', risk: { score: 0.95, decision: 'block', reasons: ['high_value', 'restricted_lane'], reviewStatus: 'pending' } } },
        ],
      })),
    );
    render(<RiskQueue onClose={() => {}} />);
    expect(await screen.findByText('AIR-2299')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /block/i })).toBeInTheDocument();
  });
});
