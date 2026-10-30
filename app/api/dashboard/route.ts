import { getDashboardWithSource } from '../../../lib/dashboard-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, source } = await getDashboardWithSource();

  return Response.json(data, {
    headers: {
      'Cache-Control': 'no-store',
      'x-data-source': source,
    },
  });
}
