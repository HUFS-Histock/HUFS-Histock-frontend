import type { Analysis, Case } from "../api";
import { percent, tone } from "../chart";

export type Indicator = "volatility" | "crash" | "returns";
export const indicators: { key: Indicator; label: string }[] = [
  { key: "volatility", label: "변동성 추정" },
  { key: "crash", label: "급락 추정 확률" },
  { key: "returns", label: "수익률 범위" },
];
type Props = {
  result: Analysis;
  enabled: Indicator[];
  onCompare: () => void;
  onHover: (c: Case | null) => void;
  onSelect: (c: Case) => void;
};
export function AnalysisPanel({
  result,
  enabled,
  onCompare,
  onHover,
  onSelect,
}: Props) {
  const r = result.risk,
    q = r.fwd_return_20d_quantiles;
  const difference =
    r.crash_prob === null || r.crash_prob_base_rate === null
      ? null
      : (r.crash_prob - r.crash_prob_base_rate) * 100;
  const position =
    q.p10 === null || q.p50 === null || q.p90 === null || q.p10 === q.p90
      ? 50
      : ((q.p50 - q.p10) / (q.p90 - q.p10)) * 100;
  return (
    <>
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
      <p className="footnote">
        급락 확률은 보정에 한계가 있으며, 수익률 범위는 미래의 신뢰구간이나 보장
        범위가 아닙니다.
      </p>
      <div className="table-heading">
        <b>비슷했던 과거의 순간</b>
        <span>
          표시 {result.cases.length}개 · 위험 통계 {r.n_neighbors}개
        </span>
        <button className="text-button" onClick={onCompare}>
          차트로 비교하기 →
        </button>
      </div>
      {result.cases.length === 0 ? (
        <div className="empty-chart" role="status">
          선택한 날짜와 비교할 과거 사례가 없습니다. 다른 날짜를 선택해 주세요.
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>기준일</th>
                <th>유사도 점수</th>
                <th>20거래일 수익률</th>
                <th>변동성 · 연율화</th>
                <th>최대낙폭</th>
                <th>급락 여부</th>
              </tr>
            </thead>
            <tbody>
              {result.cases.map((c) => (
                <tr
                  key={c.date}
                  onPointerEnter={() => onHover(c)}
                  onPointerLeave={() => onHover(null)}
                >
                  <td>
                    <button
                      className="date-button"
                      onFocus={() => onHover(c)}
                      onBlur={() => onHover(null)}
                      onClick={() => onSelect(c)}
                      aria-label={`${c.date} 분할 비교`}
                    >
                      {c.date.replaceAll("-", ".")}
                    </button>
                  </td>
                  <td>{c.similarity.toFixed(3)}</td>
                  <td className={tone(c.fwd_return_20d)}>
                    {percent(c.fwd_return_20d, true)}
                  </td>
                  <td>{percent(c.fwd_vol_20d)}</td>
                  <td className={tone(c.fwd_max_drawdown_20d)}>
                    {percent(c.fwd_max_drawdown_20d, true)}
                  </td>
                  <td>
                    {c.crash === null ? "미관측" : c.crash ? "발생" : "미발생"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="footnote">
        유사도는 상승 확률이 아닙니다. 최대낙폭 중앙값{" "}
        <span className="down">{percent(r.fwd_max_drawdown_20d_median)}</span> ·{" "}
        {result.method_desc}
      </p>
      <div className="actual">
        {result.actual ? (
          <>
            분석 기준일 이후 실제 관측: 수익률{" "}
            <b className={tone(result.actual.fwd_return_20d)}>
              {percent(result.actual.fwd_return_20d, true)}
            </b>{" "}
            · 변동성 {percent(result.actual.fwd_vol_20d)} · 최대낙폭{" "}
            {percent(result.actual.fwd_max_drawdown_20d)} · 급락{" "}
            {result.actual.crash === null
              ? "미관측"
              : result.actual.crash
                ? "발생"
                : "미발생"}
          </>
        ) : (
          "분석 기준일 이후 실제 결과: 아직 관측 기간이 완료되지 않았어요."
        )}
      </div>
      {result.query.date < "2022-01-01" && (
        <p className="notice">
          현재 CNN은 2021년까지 학습된 고정 모델입니다. 이 결과를 당시 이용
          가능했던 모델의 예측으로 해석하지 마세요.
        </p>
      )}
      <p className="footnote">{result.disclaimer}</p>
    </>
  );
}
