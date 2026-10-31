import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers });
}

function connection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !key) {
    throw new Error('Supabase 설정 누락');
  }

  return {
    url: url.replace(/\/$/, ''),
    headers: {
      apikey: key,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };
}

function passwordMatches(input: string, expected: string) {
  const hash = (value: string) =>
    createHash('sha256').update(value).digest();

  return timingSafeEqual(hash(input), hash(expected));
}

// 재료 목록 불러오기
export async function GET() {
  try {
    const db = connection();

    const response = await fetch(
      `${db.url}/rest/v1/ingredients` +
        '?select=*&store_id=eq.1&order=id.asc',
      {
        headers: db.headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      throw new Error(`조회 실패: ${response.status}`);
    }

    const ingredients = await response.json();

    if (!Array.isArray(ingredients)) {
      throw new Error('응답 형식 오류');
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
    return reply(
      { error: '재료 목록을 불러오지 못했습니다.' },
      502
    );
  }
}

// 관리자 확인 후 저장 요청
export async function POST(request: Request) {
  const expected = process.env.INVENTORY_ADMIN_PASSWORD;

  if (!expected) {
    return reply(
      { error: '관리자 비밀번호 설정 후 재배포해 주세요.' },
      503
    );
  }

  const origin = request.headers.get('origin');

  if (!origin || origin !== new URL(request.url).origin) {
    return reply(
      { error: '앱의 재고관리 화면에서 저장해 주세요.' },
      403
    );
  }

  let body: any;

  try {
    const raw = await request.text();

    if (new TextEncoder().encode(raw).length > 200000) {
      return reply({ error: '저장할 내용이 너무 큽니다.' }, 413);
    }

    body = JSON.parse(raw);
  } catch {
    return reply({ error: '저장 요청 형식이 올바르지 않습니다.' }, 400);
  }

  if (
    typeof body?.password !== 'string' ||
    body.password.length > 1024 ||
    !passwordMatches(body.password, expected)
  ) {
    return reply({ error: '관리자 비밀번호를 확인해 주세요.' }, 401);
  }

  if (
    !Array.isArray(body.materials) ||
    body.materials.length < 1 ||
    body.materials.length > 300
  ) {
    return reply({ error: '재료 목록을 확인해 주세요.' }, 400);
  }

  const numberFields = [
    'stock', 'excluded', 'incoming', 'allocated',
    'daily', 'lead', 'safety', 'period', 'quantity', 'pack',
  ];

  const names = new Set<string>();

  for (const m of body.materials) {
    if (
      !m ||
      typeof m.name !== 'string' ||
      !m.name.trim() ||
      m.name.length > 100 ||
      typeof m.unit !== 'string' ||
      !['g', 'kg', 'ml', 'L', '봉', '병', '개', '통'].includes(m.unit) ||
      names.has(m.name.trim()) ||
      numberFields.some(
        key =>
          typeof m[key] !== 'number' ||
          !Number.isFinite(m[key]) ||
          m[key] < 0 ||
          m[key] > 100000000
      ) ||
      !Number.isInteger(m.lead) ||
      !Number.isInteger(m.period) ||
      m.pack <= 0 ||
      m.quantity <= 0 ||
      m.excluded > m.stock ||
      !['정량발주', '정기발주'].includes(m.mode) ||
      !Array.isArray(m.drinks) ||
      m.drinks.length > 100
    ) {
      return reply(
        { error: '재료명 중복, 단위 또는 수량을 확인해 주세요.' },
        400
      );
    }

    names.add(m.name.trim());

    for (const d of m.drinks) {
      if (
        !d ||
        typeof d.name !== 'string' ||
        !d.name.trim() ||
        d.name.length > 100 ||
        typeof d.perCup !== 'number' ||
        !Number.isFinite(d.perCup) ||
        d.perCup < 0 ||
        d.perCup > 100000000 ||
        !Number.isSafeInteger(d.cups) ||
        d.cups < 0 ||
        d.cups > 100000000
      ) {
        return reply({ error: '음료별 사용량을 확인해 주세요.' }, 400);
      }
    }
  }

  if (
    !body.drinkSales ||
    typeof body.drinkSales !== 'object' ||
    Array.isArray(body.drinkSales) ||
    Object.keys(body.drinkSales).length > 300 ||
    Object.entries(body.drinkSales).some(
      ([name, value]) =>
        !name.trim() ||
        name.length > 100 ||
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        value > 100000000
    )
  ) {
    return reply({ error: '음료 예상 판매량을 확인해 주세요.' }, 400);
  }

  if (
    typeof body.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
    !Number.isFinite(Date.parse(body.date))
  ) {
    return reply({ error: '계획 날짜를 확인해 주세요.' }, 400);
  }

  try {
    const db = connection();

    const response = await fetch(
      `${db.url}/rest/v1/rpc/save_inventory`,
      {
        method: 'POST',
        headers: db.headers,
        body: JSON.stringify({
          p_materials: body.materials,
          p_drink_sales: body.drinkSales,
          p_plan_date: body.date,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.warn('[inventory] 저장 실패:', response.status);

      return reply(
        { error: 'DB 저장에 실패했습니다. 저장 함수 설정과 입력값을 확인해 주세요.' },
        502
      );
    }

    const result = await response.json();

    return reply({
      saved: true,
      source: 'db',
      result,
    });
  } catch {
    return reply(
      {
        error:
          '저장 결과를 확인하지 못했습니다. 연결 복구 후 저장 상태를 확인해 주세요.',
      },
      502
    );
  }
}
