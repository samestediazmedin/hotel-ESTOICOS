/**
 * Default MSW request handlers — INTENTIONALLY EMPTY.
 *
 * Tests that need to mock specific endpoints should add handlers via
 * `server.use(http.get('/api/foo', () => HttpResponse.json({...})))`
 * inside their own `beforeEach`.
 *
 * Any unhandled HTTP call during a test will produce a `console.warn`
 * (NOT fail the test) so we can incrementally identify and mock them.
 */
import type { RequestHandler } from 'msw';

export const handlers: RequestHandler[] = [];
