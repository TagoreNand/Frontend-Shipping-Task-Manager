import { describe, expect, it } from 'vitest';
import { formatBaggage, parseBaggage } from './baggage';

describe('baggage', () => {
  it('formats and parses round-trip, dropping empties', () => {
    const header = formatBaggage({ 'deployment.environment': 'docker', 'enduser.role': 'admin', skip: '' });
    expect(header).toContain('deployment.environment=docker');
    expect(header).not.toContain('skip');
    expect(parseBaggage(header)).toEqual({ 'deployment.environment': 'docker', 'enduser.role': 'admin' });
  });

  it('parses an empty/undefined header to {}', () => {
    expect(parseBaggage(undefined)).toEqual({});
  });
});
