export type Outcome = {
  fwd_return_20d: number | null;
  fwd_vol_20d: number | null;
  fwd_max_drawdown_20d: number | null;
  crash: boolean | null;
};
export type Case = Outcome & {
  date: string;
  similarity: number;
  path: number[] | null;
  summary: string | null;
};
export type Analysis = {
  query: { date: string; requested: string; path: number[] | null };
  method: string;
  method_desc: string;
  cases: Case[];
  risk: {
    n_neighbors: number;
    fwd_vol_20d: number | null;
    fwd_vol_model: string;
    fwd_vol_20d_cases: number | null;
    crash_prob: number | null;
    crash_prob_base_rate: number | null;
    fwd_return_20d_quantiles: {
      p10: number | null;
      p50: number | null;
      p90: number | null;
    };
    fwd_max_drawdown_20d_median: number | null;
  };
  actual: Outcome | null;
  disclaimer: string;
};
export type Health = {
  status: string;
  date_start: string;
  date_end: string;
  data_date: string;
  stale: boolean;
  business_days_behind: number;
};
export type Methods = { default: string; methods: Record<string, string> };
export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Snapshot = {
  analysis: Analysis;
  prices: Candle[];
  source: string;
  dataDate: string;
};

const invalid = () =>
  new Error("서버 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw invalid();
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw invalid();
  return value;
}
function nullable(value: unknown): number | null {
  return value === null ? null : number(value);
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw invalid();
  return value;
}
export function date(value: unknown): string {
  const s = string(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw invalid();
  return s;
}
function probability(value: unknown): number | null {
  const n = nullable(value);
  if (n !== null && (n < 0 || n > 1)) throw invalid();
  return n;
}
function path(value: unknown): number[] | null {
  if (value === undefined || value === null) return null;
  const values = object(value).spy_cum_return;
  if (!Array.isArray(values) || values.length !== 20) throw invalid();
  return values.map((v) => {
    const n = number(v);
    if (n <= -1) throw invalid();
    return n;
  });
}
function outcome(value: unknown): Outcome {
  const v = object(value);
  return {
    fwd_return_20d: nullable(v.fwd_return_20d),
    fwd_vol_20d: nullable(v.fwd_vol_20d),
    fwd_max_drawdown_20d: nullable(v.fwd_max_drawdown_20d),
    crash: v.crash === null ? null : boolean(v.crash),
  };
}
export function parseAnalysis(value: unknown): Analysis {
  const v = object(value),
    q = object(v.query),
    r = object(v.risk),
    quantiles = object(r.fwd_return_20d_quantiles);
  if (!Array.isArray(v.cases)) throw invalid();
  const queryDate = date(q.date),
    neighbors = number(r.n_neighbors);
  if (!Number.isInteger(neighbors) || neighbors < 0) throw invalid();
  const cases = v.cases.map((item) => {
    const c = object(item),
      explanation = c.explain == null ? null : object(c.explain);
    const caseDate = date(c.date);
    if (caseDate >= queryDate) throw invalid();
    return {
      ...outcome(c),
      date: caseDate,
      similarity: number(c.similarity),
      path: path(explanation?.path),
      summary:
        explanation?.summary == null ? null : string(explanation.summary),
    };
  });
  if (new Set(cases.map((c) => c.date)).size !== cases.length) throw invalid();
  const p10 = nullable(quantiles.p10),
    p50 = nullable(quantiles.p50),
    p90 = nullable(quantiles.p90);
  if (p10 !== null && p50 !== null && p90 !== null && (p10 > p50 || p50 > p90))
    throw invalid();
  return {
    query: {
      date: queryDate,
      requested: date(q.requested),
      path: path(q.path),
    },
    method: string(v.method),
    method_desc: string(v.method_desc),
    cases,
    risk: {
      n_neighbors: neighbors,
      fwd_vol_20d: nullable(r.fwd_vol_20d),
      fwd_vol_model:
        typeof r.fwd_vol_model === "string" ? r.fwd_vol_model : "모델",
      fwd_vol_20d_cases: nullable(r.fwd_vol_20d_cases),
      crash_prob: probability(r.crash_prob),
      crash_prob_base_rate: probability(r.crash_prob_base_rate),
      fwd_return_20d_quantiles: { p10, p50, p90 },
      fwd_max_drawdown_20d_median: nullable(r.fwd_max_drawdown_20d_median),
    },
    actual: v.actual === null ? null : outcome(v.actual),
    disclaimer: string(v.disclaimer),
  };
}
export function parseHealth(value: unknown): Health {
  const v = object(value);
  const result = {
    status: string(v.status),
    date_start: date(v.date_start),
    date_end: date(v.date_end),
    data_date: date(v.data_date),
    stale: boolean(v.stale),
    business_days_behind: number(v.business_days_behind),
  };
  if (result.date_start > result.date_end) throw invalid();
  return result;
}
export function parseMethods(value: unknown): Methods {
  const v = object(value),
    methods = Object.fromEntries(
      Object.entries(object(v.methods)).map(([k, val]) => [k, string(val)]),
    );
  const defaultMethod = string(v.default);
  if (!Object.hasOwn(methods, defaultMethod)) throw invalid();
  return { default: defaultMethod, methods };
}
export function parseSnapshot(value: unknown): Snapshot {
  const v = object(value);
  if (!Array.isArray(v.prices)) throw invalid();
  const prices = v.prices.map((item) => {
    const c = object(item);
    const result = {
      date: date(c.date),
      open: number(c.open),
      high: number(c.high),
      low: number(c.low),
      close: number(c.close),
      volume: number(c.volume),
    };
    if (
      result.low <= 0 ||
      result.volume < 0 ||
      result.high < Math.max(result.open, result.close, result.low) ||
      result.low > Math.min(result.open, result.close)
    )
      throw invalid();
    return result;
  });
  if (prices.some((p, i) => i > 0 && p.date <= prices[i - 1].date))
    throw invalid();
  const analysis = parseAnalysis(v.analysis),
    dataDate = date(v.dataDate);
  if (prices.at(-1)?.date !== dataDate || analysis.query.date !== dataDate)
    throw invalid();
  return { analysis, prices, source: string(v.source), dataDate };
}
export async function request<T>(
  url: string,
  parse: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(70000);
  let response: Response;
  try {
    response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      timeout.aborted
        ? "응답 시간이 초과되었습니다. 다시 시도해 주세요."
        : "서버에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "서버 응답을 읽을 수 없습니다. 서버 실행 상태를 확인해 주세요.",
    );
  }
  if (!response.ok) {
    const v = object(body);
    throw new Error(
      typeof v.message === "string" && v.message.trim()
        ? v.message
        : `요청에 실패했습니다 (${response.status}). 다시 시도해 주세요.`,
    );
  }
  return parse(body);
}
export function search(
  dateValue: string,
  method: string,
  signal?: AbortSignal,
): Promise<Analysis> {
  const params = new URLSearchParams({
    date: date(dateValue),
    method,
    cases: "5",
    explain: "true",
  });
  return request(`/api/v1/analysis/search?${params}`, parseAnalysis, signal);
}
