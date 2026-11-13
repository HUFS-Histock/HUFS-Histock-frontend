/**
 * 로컬 e2e 검증용 합성 snapshot.json 생성기.
 * 실 AI 저장소(../HUFS-Histock-AI) 없이도 스냅숏 기반 테스트(차트 줌/팬/애니메이션,
 * 오프라인 저장본 폴백)를 돌릴 수 있게 한다. 결정적(deterministic)이라 재생성해도 같은 데이터.
 *
 * 사용: node scripts/make-test-snapshot.mjs
 * 출력: public/snapshot.json (gitignored — 커밋되지 않음)
 * 주의: 백엔드 API가 필요한 e2e(live search 계열)는 여전히 로컬 백엔드가 있어야 한다.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 재현 가능한 난수 (LCG).
let seed = 20261102;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// 2026-11-02(월)까지의 평일만으로 구성된 거래일 그리드. windowFor의 5일 갭 규칙을 만족한다.
const DATA_DATE = "2026-11-02";
const TOTAL_DAYS = 300;
const dates = [];
for (let time = Date.parse(DATA_DATE); dates.length < TOTAL_DAYS; time -= 86400000) {
  const day = new Date(time).getUTCDay();
  if (day !== 0 && day !== 6) dates.unshift(new Date(time).toISOString().slice(0, 10));
}

// SPY 비슷한 가격대의 랜덤 워크. 마지막 봉은 반드시 하락(e2e의 ▼ 등락 검증용).
let close = 560;
const prices = dates.map((date, i) => {
  const open = +(close + (rnd() - 0.5) * 2).toFixed(2);
  close = +(close + (rnd() - 0.5) * 7).toFixed(2);
  // 반올림 후에도 high ≥ max(open, close), low ≤ min(open, close)가 성립해야 파서를 통과한다.
  const high = +(Math.max(open, close) + rnd() * 2).toFixed(2);
  const low = +(Math.min(open, close) - rnd() * 2).toFixed(2);
  return {
    date,
    open,
    high,
    low,
    close,
    volume: Math.round(40_000_000 + rnd() * 80_000_000),
  };
});
const last = prices.at(-1);
last.close = +(prices.at(-2).close - 3.5).toFixed(2);
last.low = +(Math.min(last.open, last.close) - 1).toFixed(2);

// 과거 사례 5개 — 각각 스냅숏 가격 안에서 20거래일 창을 가지는 날짜.
const caseOutcomes = [45, 75, 105, 135, 165].map((index, i) => ({
  date: prices[index].date,
  similarity: +(0.98 - i * 0.03).toFixed(3),
  path: null,
  summary: null,
  fwd_return_20d: +((rnd() - 0.45) * 0.12).toFixed(4),
  fwd_vol_20d: +(0.1 + rnd() * 0.1).toFixed(4),
  fwd_max_drawdown_20d: +(-(0.03 + rnd() * 0.08)).toFixed(4),
  crash: false,
}));

const analysis = {
  query: { date: DATA_DATE, requested: DATA_DATE, path: null },
  method: "hybrid",
  method_desc: "유사국면 결합 모델 · 합성 테스트 데이터",
  cases: caseOutcomes,
  risk: {
    n_neighbors: 12,
    fwd_vol_20d: 0.142,
    fwd_vol_model: "유사 사례 기반 추정",
    fwd_vol_20d_cases: 0.151,
    crash_prob: 0.11,
    crash_prob_base_rate: 0.08,
    fwd_return_20d_quantiles: { p10: -0.042, p50: 0.011, p90: 0.063 },
    fwd_max_drawdown_20d_median: -0.052,
  },
  actual: null,
  disclaimer:
    "합성 테스트 스냅숏입니다. 실제 시세가 아니며 투자 판단의 근거로 사용할 수 없습니다.",
};

const snapshot = {
  analysis,
  prices,
  source: "synthetic-e2e",
  dataDate: DATA_DATE,
};

const target = join(root, "public/snapshot.json");
writeFileSync(target, JSON.stringify(snapshot), "utf-8");
console.log(
  `${target} 생성 완료 · 봉 ${prices.length}개 (${dates[0]} ~ ${DATA_DATE}) · 사례 ${caseOutcomes.length}개`,
);
