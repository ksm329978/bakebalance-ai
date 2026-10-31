import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store',
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !key) {
    return Response.json(
      { error: 'Supabase 연결 설정을 확인해 주세요.' },
      { status: 503, headers }
    );
  }

  try {
    const response = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/ingredients` +
        '?select=*&store_id=eq.1&order=id.asc',
      {
        headers: {
          apikey: key,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      console.warn(
        '[inventory] 조회 실패:',
        response.status
      );

      return Response.json(
        { error: '재료 목록을 불러오지 못했습니다.' },
        { status: 502, headers }
      );
    }

    const ingredients = await response.json();

    if (!Array.isArray(ingredients)) {
      throw new Error('재료 응답 형식 오류');
    }

    return Response.json(
      {
        source: 'db',
        count: ingredients.length,
        ingredients,
      },
      {
        headers: {
          ...headers,
          'x-data-source': 'db',
        },
      }
    );
  } catch {
    return Response.json(
      { error: '재료 조회 중 연결 오류가 발생했습니다.' },
      { status: 502, headers }
    );
  }
}
