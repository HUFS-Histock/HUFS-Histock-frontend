import type { Analysis } from "../../lib/api";
import { percent, tone } from "../../lib/format";
import type { Indicator } from "./indicators";

type Props = {
  risk: Analysis["risk"];
  enabled: Indicator[];
};

/** 선택한 보조지표(변동성·급락 확률·수익률 범위) 카드 그리드. */
export function IndicatorMetrics({ risk: r, enabled }: Props) {
  const q = r.fwd_return_20d_quantiles;
  const difference =
    r.crash_prob === null || r.crash_prob_base_rate === null
      ? null
      : (r.crash_prob - r.crash_prob_base_rate) * 100;
  const position =
    q.p10 === null || q.p50 === null || q.p90 === null || q.p10 === q.p90
      ? 50
      : ((q.p50 - q.p10) / (q.p90 - q.p10)) * 100;
  return (
    <div
      className="metrics"
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, enabled.length)}, minmax(0, 1fr))`,
      }}
    >
      {enabled.includes("volatility") && (
        <article>
          <h3>
            변동성 추정{" "}
            <span title="수익률이 흔들리는 정도이며 예상 수익률이 아닙니다.">
              ⓘ
            </span>
          </h3>
          <strong data-testid="volatility">{percent(r.fwd_vol_20d)}</strong>
          <p>연율화 · 이후 20거래일 · {r.fwd_vol_model}</p>
          <div className="stat-caption">
            유사 사례 기반 <b>{percent(r.fwd_vol_20d_cases)}</b>
          </div>
        </article>
      )}
      {enabled.includes("crash") && (
        <article>
          <h3>급락 추정 확률 ⓘ</h3>
          <strong>{percent(r.crash_prob)}</strong>
          <span
            className={
              difference !== null && difference > 0
                ? "difference up"
                : "difference down"
            }
          >
            {difference === null
              ? ""
              : `기준 대비 ${difference > 0 ? "+" : ""}${difference.toFixed(1)}%p`}
          </span>
          <p>
            비교 기준 {percent(r.crash_prob_base_rate)} · 최대낙폭 5% 이상
          </p>
          <div className="probability">
            현재{" "}
            {r.crash_prob === null ? '미제공' : <span>
              <i style={{ width: `${r.crash_prob * 100}%` }} />
            </span>}
          </div>
          <div className="probability baseline">
            기준{" "}
            {r.crash_prob_base_rate === null ? '미제공' : <span>
              <i
                style={{ width: `${r.crash_prob_base_rate * 100}%` }}
              />
            </span>}
          </div>
        </article>
      )}
      {enabled.includes("returns") && (
        <article>
          <h3>유사 사례 수익률 범위 ⓘ</h3>
          <div className="quantiles">
            {(
              [
                ["10백분위", q.p10],
                ["중앙값", q.p50],
                ["90백분위", q.p90],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <strong className={tone(value)}>
                  {percent(value, true)}
                </strong>
                <p>{label}</p>
              </div>
            ))}
          </div>
          {q.p10 !== null && q.p50 !== null && q.p90 !== null && <div className="range-track">
            <i style={{ left: `${position}%` }} />
          </div>}
          <p>이웃 {r.n_neighbors}개 · 이후 20거래일 분포</p>
        </article>
      )}
    </div>
  );
}
