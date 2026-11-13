import type { Analysis, Case } from "../../lib/api";
import { percent, tone } from "../../lib/format";

type Props = {
  result: Analysis;
  onCompare: () => void;
  onHover: (c: Case | null) => void;
  onSelect: (c: Case) => void;
};

/** 유사했던 과거 사례 목록: 제목·차트 비교 버튼과 사례 표. */
export function CasesTable({ result, onCompare, onHover, onSelect }: Props) {
  const r = result.risk;
  return (
    <>
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
                      onPointerDown={(event) => {
                        // Keep the click on this button if the hover chart reflows on focus.
                        if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId);
                      }}
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
    </>
  );
}
