import { describe, expect, it } from 'vitest';
import { APP_ROUTES, getRouteByPath } from '../../src/shared/domain/navigation';

describe('application navigation', () => {
  it('defines the six foundation routes in the intended order', () => {
    expect(APP_ROUTES.map((route) => route.path)).toEqual([
      '/',
      '/planner',
      '/syllabus',
      '/tests',
      '/results',
      '/tutor',
    ]);
  });

  it('falls back to the dashboard for an unknown route title', () => {
    expect(getRouteByPath('/unknown').label).toBe('Dashboard');
  });
});

