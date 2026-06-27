import { describe, expect, it } from 'vitest';
import { parseBaggage } from './baggage';

describe('parseBaggage', () => {
  it('parses entries and ignores junk', () => {
    expect(parseBaggage('deployment.environment=docker,enduser.role=admin')).toEqual({
      'deployment.environment': 'docker',
      'enduser.role': 'admin',
    });
    expect(parseBaggage(undefined)).toEqual({});
    expect(parseBaggage('nokeyvalue')).toEqual({});
  });
});
