import 'server-only';
import dashboard from '../data/dashboard.json';

type Dashboard = typeof dashboard;

type Product = {
  id: number;
  name: string;
};

type DailyRow = {
  product_id: number;
  record_date: string;
  produced: number;
  sold: number;
  waste: number;
  remaining: number;
  planned: number;
  reason: string;
  status: string;
  is_mock: boolean;
};

// 기존 AI 분석에서 사용하는 mock
export function getDashboard(): Dashboard {
  return structuredClone(dashboard);
}

// 서버에서만 Supabase에 접근합니다.
async function readTable<T>(path: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !key) {
    throw new Error('Supabase 환경변수 누락');
  }

  const response = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/${path}`,
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
    throw new Error(`Supabase 조회 실패: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Supabase 응답 형식 오류');
  }

  return data as T[];
}

export async function getDashboardWithSource(): Promise<{
  data: Dashboard;
  source: 'db' | 'mock';
}> {
  try {
    const [stores, products] = await Promise.all([
      readTable<{ id: number; name: string }>(
        'stores?select=id,name&id=eq.1'
      ),
      readTable<Product>(
        'products?select=id,name&store_id=eq.1&order=id.asc'
      ),
    ]);

    if (!stores.length || !products.length) {
      throw new Error('매장 또는 제품 데이터 없음');
    }

    const ids = products.map(product => product.id).join(',');
    const filter = `product_id=in.(${ids})`;

    const latest = await readTable<{ record_date: string }>(
      `daily_records?select=record_date&${filter}` +
      '&order=record_date.desc&limit=1'
    );

    if (!latest.length) {
      throw new Error('일일기록 없음');
    }

    const date = latest[0].record_date;
    const rows = await readTable<DailyRow>(
      `daily_records?select=*&${filter}` +
      `&record_date=eq.${encodeURIComponent(date)}` +
      '&order=product_id.asc'
    );

    if (!rows.length) {
      throw new Error('선택 날짜의 기록 없음');
    }

    const recent = rows.map(row => {
      const product = products.find(
        item => item.id === row.product_id
      );

      if (!product) {
        throw new Error('제품 연결 오류');
      }

      return {
        id: product.id,
        name: product.name,
        produced: row.produced,
        sold: row.sold,
        waste: row.waste,
        remaining: row.remaining,
        planned: row.planned,
        reason: row.reason,
        status: row.status,
      };
    });

    const totals = recent.reduce(
      (sum, row) => ({
        produced: sum.produced + row.produced,
        sold: sum.sold + row.sold,
        waste: sum.waste + row.waste,
        remaining: sum.remaining + row.remaining,
      }),
      { produced: 0, sold: 0, waste: 0, remaining: 0 }
    );

    return {
      data: {
        storeName: stores[0].name,
        date,
        isMock: rows.some(row => row.is_mock),
        totals,
        recent,
      },
      source: 'db',
    };
  } catch (error) {
    console.warn(
      '[dashboard] mock으로 대체:',
      error instanceof Error ? error.message : '조회 오류'
    );

    return {
      data: getDashboard(),
      source: 'mock',
    };
  }
}
