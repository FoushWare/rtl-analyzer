import { describe, expect, it } from 'vitest';
import { DASHBOARD_ORIGIN, isAllowedDashboardOrigin } from '../src/companion-security.js';

describe('companion state-changing request security', () => {
  it('allows only the exact dashboard origin and rejects absent or lookalike origins', () => {
    expect(isAllowedDashboardOrigin(DASHBOARD_ORIGIN)).toBe(true);
    expect(isAllowedDashboardOrigin(undefined)).toBe(false);
    expect(isAllowedDashboardOrigin('http://localhost:4320')).toBe(false);
    expect(isAllowedDashboardOrigin('http://127.0.0.1:4320.evil.test')).toBe(false);
  });
});
