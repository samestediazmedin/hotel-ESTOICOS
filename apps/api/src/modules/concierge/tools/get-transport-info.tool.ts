/**
 * get-transport-info.tool.ts — OpenAI function-calling tool: get_transport_info
 *
 * READ-ONLY: this handler calls ONLY ConciergeRepository read methods.
 * No prisma.*.create/update/delete/upsert calls allowed here — enforced by
 * concierge-tool-registry.spec.ts (grep test, CON-04).
 *
 * MVP note: returns empty options array. The system prompt (08-02) instructs the
 * assistant to say "Por favor consulta con recepción para opciones de transporte"
 * when options is empty.
 */

import { z } from 'zod';
import type { ConciergeRepository } from '../concierge.repository';

export const GetTransportInfoSchema = z.object({
  fromArea: z.string().min(1).max(200),
  toArea: z.string().min(1).max(200),
});

export type GetTransportInfoArgs = z.infer<typeof GetTransportInfoSchema>;

export const GetTransportInfoTool = {
  name: 'get_transport_info' as const,
  schema: GetTransportInfoSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'get_transport_info',
      description:
        'Get transport options from one area of Bogotá to another (taxi, TransMilenio, etc.). ' +
        'Returns available transport options if known. If options is empty, ask reception for help.',
      parameters: {
        type: 'object',
        properties: {
          fromArea: {
            type: 'string',
            description: 'Departure area or address (e.g. "El hotel", "Zona Rosa", "El Dorado")',
          },
          toArea: {
            type: 'string',
            description: 'Destination area or address',
          },
        },
        required: ['fromArea', 'toArea'],
      },
    },
  },

  async handler(
    args: GetTransportInfoArgs,
    deps: { repo: ConciergeRepository },
  ): Promise<unknown> {
    return deps.repo.getTransportInfo({
      fromArea: args.fromArea,
      toArea: args.toArea,
    });
  },
};
