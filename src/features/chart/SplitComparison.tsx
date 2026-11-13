import type { Analysis, Case, Snapshot } from "../../lib/api";
import { percent, tone } from "../../lib/format";
import { windowFor } from "./chartMath";
import { Chart } from "./Chart";

type Props = {
  selected: Case;
  displayDate: string | undefined;
  snapshot: Snapshot | null;
  result: Analysis | null;
  chartType: "candle" | "line";
};

export function SplitComparison({
  selected,
  displayDate,
  snapshot,
  result,
  chartType,
}: Props) {
  const pastCandles = snapshot ? windowFor(snapshot.prices, selected.date) : null;
  const current20 =
    snapshot && displayDate ? windowFor(snapshot.prices, displayDate) : null;
  return (
    <>
      <div className="split">
        <section>
          <h3 className="past">과거 · {selected.date}</h3>
          <Chart
            candles={pastCandles}
            history={
              snapshot
                ? windowFor(snapshot.prices, selected.date, 21)
                : null
            }
            path={selected.path}
            type={chartType}
            title="과거"
          />
        </section>
        <section>
          <h3 className="current">현재 · {displayDate}</h3>
          <Chart
            candles={current20}
            history={
              snapshot && displayDate
                ? windowFor(snapshot.prices, displayDate, 21)
                : null
            }
            path={result?.query.path}
            type={chartType}
            title="현재"
          />
        </section>
      </div>
      <div className="selected-outcome">
        <b>선택한 과거 사례의 이후 20거래일</b>
        <p>
          수익률{" "}
          <span className={tone(selected.fwd_return_20d)}>
            {percent(selected.fwd_return_20d, true)}
          </span>{" "}
          · 최대낙폭 {percent(selected.fwd_max_drawdown_20d)}
        </p>
        <small>
          차트는 기준일까지의 입력 구간입니다. 각 차트의 가격·거래량 축은
          독립적입니다.
        </small>
        {selected.summary && <p>{selected.summary}</p>}
      </div>
    </>
  );
}
