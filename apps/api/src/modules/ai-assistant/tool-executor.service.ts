import { BadRequestException, ForbiddenException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ZodError } from 'zod';
import { TOOL_REGISTRY, TOOL_REGISTRY_COUNT } from './tool-registry';
import type { Role, ToolDef, ToolDeps, UserContext } from './tool-registry';
import { AiToolCallLogRepository } from './audit-log.repository';
import type { AiToolCallLogInput } from './audit-log.repository';

/**
 * ToolExecutorService — executes AI tool calls with role gate, Zod validation, and try/finally audit.
 *
 * AI-09: Every tool invocation writes an audit row to ai_tool_call_logs,
 * REGARDLESS of whether the tool succeeded, threw a runtime error, failed
 * Zod input validation, or was rejected by the role gate.
 *
 * AI-04: onModuleInit() asserts that exactly 9 tools are registered.
 * If the count changes, the module fails to boot — enforcement at the DI layer.
 *
 * AI-05: All tool inputs are parsed by Zod schema before any service call.
 * ZodError is caught, logged as 'validation_error', then re-thrown.
 *
 * AI-23: Role gate checks userCtx.role against tool.allowedRoles BEFORE
 * Zod validation or handler execution. Rejected calls are audited with 'rejected'.
 */
@Injectable()
export class ToolExecutorService implements OnModuleInit {
  constructor(
    private readonly auditRepo: AiToolCallLogRepository,
    @Inject('TOOL_DEPS') private readonly deps: ToolDeps,
  ) {}

  /**
   * onModuleInit — asserts exactly 9 tools at module startup.
   * Fails fast if tool count is wrong (AI-04 enforcement).
   */
  onModuleInit(): void {
    const count = TOOL_REGISTRY_COUNT;
    if (count !== 9) {
      throw new Error(`AI tool registry has ${count} tools, expected 9. Fix TOOL_REGISTRY in tool-registry.ts`);
    }
  }

  /**
   * executeOne — executes a single tool call with full audit trail.
   *
   * Flow:
   * 1. Resolve tool from registry — throws if unknown
   * 2. Role gate — throws ForbiddenException if user's role is not in allowedRoles (AI-23)
   * 3. Parse input with Zod schema — ZodError on invalid input
   * 4. Execute handler with validated input
   * 5. ALWAYS (try/finally): write audit row with outputStatus + durationMs
   *
   * @param toolName - Name of the tool to execute (must be in TOOL_REGISTRY)
   * @param rawInput - Raw input from OpenAI tool_call.function.arguments (parsed JSON)
   * @param userCtx - JWT user context (id, email, role)
   * @param conversationId - Optional conversation ID for audit trail linkage
   */
  async executeOne(
    toolName: string,
    rawInput: unknown,
    userCtx: UserContext,
    conversationId?: string,
  ): Promise<{ toolName: string; sanitizedOutput: unknown }> {
    const startMs = Date.now();

    const logEntry: Partial<AiToolCallLogInput> = {
      userId: userCtx.id,
      conversationId: conversationId ?? null,
      toolName,
      inputJson: rawInput as Record<string, unknown>,
      outputStatus: 'success',
    };

    try {
      // Step 1: Resolve tool
      const def = (TOOL_REGISTRY as Record<string, ToolDef>)[toolName];
      if (!def) {
        logEntry.outputStatus = 'error';
        logEntry.errorMsg = `Unknown tool: ${toolName}`;
        throw new BadRequestException(`Unknown tool: ${toolName}`);
      }

      // Step 2: Role gate (AI-23) — check BEFORE Zod validation or handler execution
      if (!def.allowedRoles.includes(userCtx.role as Role)) {
        logEntry.outputStatus = 'rejected';
        logEntry.errorMsg = `role_not_allowed: ${userCtx.role}`;
        throw new ForbiddenException(`Tool '${toolName}' not available for role '${userCtx.role}'`);
      }

      // Step 3: Zod validation (AI-05)
      let validatedInput: unknown;
      try {
        validatedInput = def.schema.parse(rawInput);
      } catch (err) {
        if (err instanceof ZodError) {
          logEntry.outputStatus = 'validation_error';
          logEntry.errorMsg = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
          throw err;
        }
        throw err;
      }

      // Step 4: Execute handler
      const sanitizedOutput = await def.handler(validatedInput, userCtx, this.deps);

      logEntry.outputStatus = 'success';
      return { toolName, sanitizedOutput };
    } catch (err) {
      // If error was not already classified above, classify it now
      if (logEntry.outputStatus === 'success') {
        logEntry.outputStatus = err instanceof ZodError ? 'validation_error' : 'error';
        logEntry.errorMsg = err instanceof Error ? err.message : String(err);
      }
      throw err;
    } finally {
      // AI-09: ALWAYS write audit row — even on throw
      logEntry.durationMs = Date.now() - startMs;
      await this.auditRepo.insert(logEntry as AiToolCallLogInput);
    }
  }
}
