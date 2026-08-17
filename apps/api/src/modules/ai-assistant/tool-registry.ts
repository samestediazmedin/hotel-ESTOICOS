/**
 * tool-registry.ts — Central registry of all 9 read-only AI tools.
 *
 * AI-03: Exactly 9 tools registered here (7 original + 2 housekeeping).
 * AI-04: All handlers are read-only — no .create(), .update(), .delete() calls.
 * AI-23: Each tool has an allowedRoles array for per-tool RBAC enforcement.
 *
 * The registry is used by:
 * - ToolExecutorService: executes tools with Zod validation + role gate + try/finally audit
 * - AiAssistantService: passes filtered OPENAI_TOOL_DEFINITIONS to the OpenAI API per role
 *
 * ToolDeps is injected via the 'TOOL_DEPS' provider in AiAssistantModule.
 */

import type OpenAI from 'openai';
import { z } from 'zod';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AvailabilityService } from '../reservations/availability.service';
import type { DashboardService } from '../reporting/dashboard.service';
import type { GuestsService } from '../guests/guests.service';
import type { ReservationsService } from '../reservations/reservations.service';
import type { FolioService } from '../folio/folio.service';
import type { sanitizeInput } from './sanitize';

import { GetAvailabilitySchema, getAvailabilityHandler } from './tools/get-availability.tool';
import { GetOccupancyKpiSchema, getOccupancyKpiHandler } from './tools/get-occupancy-kpi.tool';
import { FindGuestSchema, findGuestHandler } from './tools/find-guest.tool';
import { GetReservationSchema, getReservationHandler } from './tools/get-reservation.tool';
import { NoInputSchema as CheckinsNoInput, getCheckinsTodayHandler } from './tools/get-checkins-today.tool';
import { NoInputSchema as CheckoutsNoInput, getCheckoutsTodayHandler } from './tools/get-checkouts-today.tool';
import { GetFolioSummarySchema, getFolioSummaryHandler } from './tools/get-folio-summary.tool';
import { GetRoomCleaningStatusSchema, getRoomCleaningStatusHandler } from './tools/get-room-cleaning-status.tool';
import { GetMyCleaningAssignmentsSchema, getMyCleaningAssignmentsHandler } from './tools/get-my-cleaning-assignments.tool';

// ─── Type definitions ──────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING';

export type ToolName =
  | 'get_availability'
  | 'get_occupancy_kpi'
  | 'find_guest'
  | 'get_reservation'
  | 'get_checkins_today'
  | 'get_checkouts_today'
  | 'get_folio_summary'
  | 'get_room_cleaning_status'
  | 'get_my_cleaning_assignments';

export interface UserContext {
  id: string;
  email: string;
  role: string;
}

export interface ToolDeps {
  availability: AvailabilityService;
  dashboard: DashboardService;
  guests: GuestsService;
  reservations: ReservationsService;
  folio: FolioService;
  prisma: PrismaService;
  sanitize: typeof sanitizeInput;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolDef<TInput = unknown, TOutput = unknown> {
  schema: z.ZodType<TInput>;
  handler: (input: TInput, userCtx: UserContext, deps: ToolDeps) => Promise<TOutput>;
  allowedRoles: ReadonlyArray<Role>;
}

// ─── Tool registry — exactly 9 entries (AI-03 + AI-23) ──────────────────

export const TOOL_REGISTRY: Record<ToolName, ToolDef> = {
  get_availability: {
    schema: GetAvailabilitySchema as z.ZodType,
    handler: getAvailabilityHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'RECEPTION'],
  },
  get_occupancy_kpi: {
    schema: GetOccupancyKpiSchema as z.ZodType,
    handler: getOccupancyKpiHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER'],
  },
  find_guest: {
    schema: FindGuestSchema as z.ZodType,
    handler: findGuestHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'RECEPTION'],
  },
  get_reservation: {
    schema: GetReservationSchema as z.ZodType,
    handler: getReservationHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'RECEPTION'],
  },
  get_checkins_today: {
    schema: CheckinsNoInput as z.ZodType,
    handler: getCheckinsTodayHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'RECEPTION'],
  },
  get_checkouts_today: {
    schema: CheckoutsNoInput as z.ZodType,
    handler: getCheckoutsTodayHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING'],
  },
  get_folio_summary: {
    schema: GetFolioSummarySchema as z.ZodType,
    handler: getFolioSummaryHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'RECEPTION'],
  },
  get_room_cleaning_status: {
    schema: GetRoomCleaningStatusSchema as z.ZodType,
    handler: getRoomCleaningStatusHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING'],
  },
  get_my_cleaning_assignments: {
    schema: GetMyCleaningAssignmentsSchema as z.ZodType,
    handler: getMyCleaningAssignmentsHandler as ToolDef['handler'],
    allowedRoles: ['ADMIN', 'MANAGER', 'HOUSEKEEPING'],
  },
} as const;

/** Constant count for onModuleInit assertion — avoids Object.keys() at runtime. */
export const TOOL_REGISTRY_COUNT = Object.keys(TOOL_REGISTRY).length;

// ─── OpenAI tool definitions — exactly 9 entries (AI-03 + AI-23) ────────

/**
 * OPENAI_TOOL_DEFINITIONS — JSON Schema definitions for the OpenAI function-calling API.
 *
 * Uses the current `tools` parameter format (NOT the deprecated `functions` format).
 * Each definition matches the Zod schema in its corresponding tool file.
 *
 * Passed directly to: client.chat.completions.create({ tools: ... })
 * Filtered per role via getToolDefinitionsForRole() before passing to OpenAI.
 */
export const OPENAI_TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_availability',
      description: 'Busca habitaciones disponibles para un rango de fechas y capacidad opcional.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'Fecha inicio ISO YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'Fecha fin ISO YYYY-MM-DD',
          },
          maxOccupancy: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Numero de huespedes (opcional)',
          },
        },
        required: ['startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_occupancy_kpi',
      description: 'Obtiene los KPIs de ocupacion del hotel: ocupacion %, ADR, RevPAR, ingresos del dia.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'Fecha YYYY-MM-DD (opcional; si se omite usa la fecha de negocio actual)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_guest',
      description: 'Busca huespedes por nombre. Devuelve lista de coincidencias con ID y resumen (sin datos sensibles).',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            description: 'Nombre completo o parcial del huesped',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reservation',
      description: 'Obtiene los detalles de una reserva por ID o codigo de confirmacion.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'ID UUID de la reserva (opcional si se provee confirmationCode)',
          },
          confirmationCode: {
            type: 'string',
            maxLength: 50,
            description: 'Codigo de confirmacion (opcional si se provee id)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_checkins_today',
      description: 'Lista las reservas con check-in esperado hoy.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_checkouts_today',
      description: 'Lista las reservas con check-out esperado hoy.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_folio_summary',
      description: 'Obtiene el resumen del folio de una reserva: saldo total, estado, lineas de cargo.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: {
            type: 'string',
            format: 'uuid',
            description: 'ID UUID de la reserva',
          },
        },
        required: ['reservationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_cleaning_status',
      description: 'Consulta el estado de limpieza y estado fisico de las habitaciones activas. Opcionalmente filtra por numero de habitacion.',
      parameters: {
        type: 'object',
        properties: {
          roomNumber: {
            type: 'string',
            maxLength: 20,
            description: 'Numero de habitacion (opcional; si se omite devuelve todas)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_cleaning_assignments',
      description: 'Lista las tareas de limpieza asignadas al usuario actual (pendientes o completadas hoy).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

// ─── Role-based tool filtering (AI-23) ──────────────────────────────────

/**
 * getToolDefinitionsForRole — returns only the OpenAI tool definitions
 * that the given role is allowed to use.
 *
 * This filters the tools array BEFORE passing it to OpenAI, so the LLM
 * never even sees tool definitions that the user's role cannot invoke.
 * Defense-in-depth: ToolExecutorService also checks allowedRoles at execution time.
 */
export function getToolDefinitionsForRole(role: Role): OpenAI.Chat.ChatCompletionTool[] {
  return OPENAI_TOOL_DEFINITIONS.filter((def) => {
    const toolName = (def as { type: 'function'; function: { name: string } }).function.name as ToolName;
    const toolDef = TOOL_REGISTRY[toolName];
    return toolDef?.allowedRoles.includes(role);
  });
}
