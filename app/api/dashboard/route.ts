import { getDashboard } from '../../../lib/dashboard-data';
// 5주차: AI 호출은 서버(이 파일)에서만. 비밀 키는 .env.local에 두고 화면 코드에는 쓰지 않는다.
export async function GET() {
  try { return Response.json(getDashboard(), {headers:{'Cache-Control':'no-store'}}); }
  catch { return Response.json({error:'데이터를 불러오지 못했습니다.'},{status:500}); }
}
