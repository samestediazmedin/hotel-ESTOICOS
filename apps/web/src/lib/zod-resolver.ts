/**
 * Typed wrapper around @hookform/resolvers/zod that bridges the Zod v4
 * type definitions with the resolver's overload signatures.
 *
 * Context: @hookform/resolvers@5.x ships two typed overloads for zodResolver —
 * one for Zod v3 types (Zod3Type) and one for the $ZodType interface targeting
 * Zod v4.0.x. Our project uses Zod v4.4.x, whose internal type for
 * `_zod.version.minor` is `4`, not `0` as the v4 overload expects. This causes
 * TS2769 on every `zodResolver(schema)` call even though the runtime works
 * correctly (the resolver detects schema version dynamically at runtime).
 *
 * The `as any` here is intentional and scoped: it suppresses a known false
 * positive in the resolver's type overloads, not a real type unsafety. The
 * schema is still fully typed at definition; only the resolver boundary gets
 * the cast.
 *
 * See: https://github.com/react-hook-form/resolvers/issues — Zod v4.4+ minor
 * version literal mismatch with $ZodType<unknown, FieldValues, ...> overload.
 */
import { zodResolver as _zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import type { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver<TSchema extends z.ZodTypeAny>(schema: TSchema): Resolver<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _zodResolver(schema as any) as Resolver<any>;
}
