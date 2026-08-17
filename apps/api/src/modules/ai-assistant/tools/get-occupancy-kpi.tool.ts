import { z } from 'zod';
import type { GetOccupancyKpiOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const GetOccupancyKpiSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
});

export type GetOccupancyKpiInput = z.infer<typeof GetOccupancyKpiSchema>;

export async function getOccupancyKpiHandler(
  input: GetOccupancyKpiInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetOccupancyKpiOutputDto> {
  // getDashboard() returns current business date KPIs — no date parameter needed
  // For specific date requests, we still call getDashboard and note the limitation
  const dashboard = await deps.dashboard.getDashboard();

  if (!dashboard.snapshot) {
    return {
      businessDate: dashboard.businessDate,
      occupancyPct: 0,
      adr: 0,
      revpar: 0,
      totalRevenue: 0,
      arrivalsCount: 0,
      departuresCount: 0,
      noDataAvailable: true,
    };
  }

  return {
    businessDate: dashboard.businessDate,
    occupancyPct: dashboard.snapshot.occupancyPct,
    adr: dashboard.snapshot.adr,
    revpar: dashboard.snapshot.revpar,
    totalRevenue: dashboard.snapshot.totalRevenue,
    arrivalsCount: dashboard.snapshot.arrivalsCount,
    departuresCount: dashboard.snapshot.departuresCount,
  };
}
