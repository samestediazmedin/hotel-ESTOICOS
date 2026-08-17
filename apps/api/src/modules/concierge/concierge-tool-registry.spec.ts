/**
 * concierge-tool-registry.spec.ts — TDD RED: failing tests for tool registry.
 *
 * CON-03: exactly 10 tools registered
 *   (4 Bogotá city + 3 hotel knowledge + 1 booking handoff + 2 verified review).
 * CON-04: tool handler FILE sources contain no prisma write method calls.
 *   NOTE: verify_stay_for_review and submit_guest_review ARE write-capable tools,
 *   but their handler source files delegate writes to the injected ConciergeReviewService.
 *   The handler files themselves contain no prisma.*.create/update/etc calls — only
 *   deps.conciergeReview.verifyStay() and deps.conciergeReview.submitVerifiedReview()
 *   calls. So the grep test passes correctly for these files.
 *
 * 2026-06-03 (Phase 2 concierge): count updated 7→8; check-availability.tool.ts added to CON-04 list.
 * 2026-06-03 (Phase 3 concierge): count updated 8→10; verify-stay-for-review.tool.ts and
 *   submit-guest-review.tool.ts added to CON-04 list.
 * 2026-06-03 (S02 security fix): verify-stay-for-review.tool.ts lastName min raised 2→3.
 *   Zod schema change only — no effect on registry count or CON-04 grep.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONCIERGE_TOOL_REGISTRY, CONCIERGE_TOOL_DEFINITIONS } from './concierge-tool-registry';

const TOOLS_DIR = join(__dirname, 'tools');
const WRITE_METHODS_RE = /prisma\.[a-z]+\.(create|update|delete|upsert|deleteMany|updateMany|createMany)/i;

describe('CONCIERGE_TOOL_REGISTRY', () => {
  // Test 1: exactly 10 tools
  it('has exactly 10 registered tools', () => {
    expect(Object.keys(CONCIERGE_TOOL_REGISTRY)).toHaveLength(10);
  });

  // Test 2: CONCIERGE_TOOL_DEFINITIONS is aligned with the registry
  it('CONCIERGE_TOOL_DEFINITIONS has 10 entries matching registry keys', () => {
    expect(CONCIERGE_TOOL_DEFINITIONS).toHaveLength(10);
    const registryKeys = Object.keys(CONCIERGE_TOOL_REGISTRY);
    for (const def of CONCIERGE_TOOL_DEFINITIONS) {
      // All concierge tools are function-type tools (not custom tools)
      const fnDef = def as { type: 'function'; function: { name: string } };
      expect(registryKeys).toContain(fnDef.function.name);
    }
  });

  // Test 3 (CON-04): no handler file uses Prisma write methods — all read-only
  it('no tool handler source calls prisma write methods', () => {
    const toolFiles = [
      'search-venues.tool.ts',
      'get-venue-detail.tool.ts',
      'get-transport-info.tool.ts',
      'get-event-info.tool.ts',
      'get-hotel-info.tool.ts',
      'get-hotel-amenities.tool.ts',
      'get-room-types-summary.tool.ts',
      'check-availability.tool.ts',
      // Phase 3: write-capable tools — but they call deps.conciergeReview.* methods,
      // not prisma.*.create/update directly. Grep still passes.
      'verify-stay-for-review.tool.ts',
      'submit-guest-review.tool.ts',
    ];
    for (const file of toolFiles) {
      const source = readFileSync(join(TOOLS_DIR, file), 'utf8');
      const match = source.match(WRITE_METHODS_RE);
      expect(
        match,
        `Tool handler ${file} must be read-only — found: ${match?.[0]}`,
      ).toBeNull();
    }
  });
});
