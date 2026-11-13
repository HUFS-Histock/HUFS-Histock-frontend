import type { Candle } from "../../lib/api";
import { price, tone } from "../../lib/format";

type Props = {
  title: string;
  quote: Candle;
  change: number | null;
  changeRate: number | null;
};

/** 차트 상단 시세 리드아웃: 시가·고가·저가·종가와 전 거래일 대비 등락, 거래량. */
export function QuoteReadout({ title, quote, change, changeRate }: Props) {
  return (
    <div
      className="quote-readout"
      data-testid="quote-readout"
      data-date={quote.date}
      aria-label={`${title} ${quote.date} 시세`}
      title={`${quote.date} · 보정가격 USD · 등락은 전 거래일 종가 대비`}
      aria-live="off"
    >
      {(
        [
          ["시", "시가", quote.open],
          ["고", "고가", quote.high],
          ["저", "저가", quote.low],
          ["종", "종가", quote.close],
        ] as const
      ).map(([short, label, value]) => (
        <span className="quote-item" key={short} aria-label={label}>
          <span>{short}</span>
          <b>{price(value)}</b>
        </span>
      ))}
      <span
        className={`quote-change ${tone(change)}`}
        data-testid="quote-change"
        aria-label="전 거래일 대비 등락"
      >
        {change === null || changeRate === null
          ? "전일 대비 —"
          : `${change > 0 ? "▲" : change < 0 ? "▼" : "−"} ${price(Math.abs(change))} (${changeRate > 0 ? "+" : changeRate < 0 ? "−" : ""}${Math.abs(changeRate).toFixed(2)}%)`}
      </span>
      <span className="quote-item" aria-label="거래량">
        <span>거</span>
        <b>{quote.volume.toLocaleString("en-US")}</b>
      </span>
    </div>
  );
}
