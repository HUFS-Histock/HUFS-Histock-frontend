import type { Snapshot } from "../../lib/api";
import { percent, price, tone } from "../../lib/format";

type Props = {
  snapshot: Snapshot | null;
  displayDate: string | undefined;
};

export function InstrumentSidebar({ snapshot, displayDate }: Props) {
  const end =
    snapshot && displayDate
      ? snapshot.prices.findIndex((p) => p.date === displayDate)
      : -1;
  const last = end >= 0 ? snapshot!.prices[end] : null;
  const previous = end >= 1 ? snapshot!.prices[end - 1] : null;
  const change = last && previous ? last.close - previous.close : null;
  const changeRate =
    change !== null && previous ? change / previous.close : null;
  return (
    <aside className="sidebar">
      <small>‹ 미국 종목 / ETF</small>
      <div className="exchange">NYSE Arca</div>
      <div className="instrument">
        <span className="symbol-icon">SPY</span>
        <div>
          <small>SPY · 미국 ETF</small>
          <h1>SPDR S&P 500</h1>
        </div>
      </div>
      <div className="stock-price">
        {last ? price(last.close) : "—"} <span>USD</span>
      </div>
      <div className={`stock-change ${tone(change)}`}>
        {change !== null
          ? `${change < 0 ? "▼" : "▲"} ${price(Math.abs(change))} (${percent(changeRate, true)})`
          : "가격 데이터 미제공"}
      </div>
      <small>
        {displayDate ?? "—"} {last ? "저장된 종가 기준" : "분석 기준"}
      </small>
      <dl>
        <dt>시세정보</dt>
        {[
          ["시가", last?.open],
          ["고가", last?.high],
          ["저가", last?.low],
          ["전일 종가", previous?.close],
        ].map(([label, value]) => (
          <dd key={label}>
            <span>{label}</span>
            <b className={typeof value === "number" && previous ? tone(value - previous.close) : undefined}>{typeof value === "number" ? price(value) : "—"}</b>
          </dd>
        ))}
        <dd>
          <span>거래량</span>
          <b>{last?.volume.toLocaleString("en-US") ?? "—"}</b>
        </dd>
      </dl>
      <dl>
        <dt>종목정보</dt>
        <dd>
          <span>기초지수</span>
          <b>S&amp;P 500</b>
        </dd>
        <dd>
          <span>거래 통화</span>
          <b>USD</b>
        </dd>
        <dd>
          <span>분석 대상</span>
          <b>SPY</b>
        </dd>
      </dl>
      <div className="sidebar-tip">
        <b>차트에 과거의 맥락을 더해요</b>
        <p>
          보조지표에서 AI 분석을 켜면
          <br />
          변동성 · 급락 위험 · 수익률 범위를
          <br />
          함께 살펴볼 수 있어요.
        </p>
      </div>
    </aside>
  );
}
