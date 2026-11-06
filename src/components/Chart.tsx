import { useEffect, useState } from "react";
import type { PointerEvent } from "react";
import type { Candle } from "../api";
import { geometry, movingAverage, normalized, price, tone } from "../chart";

type Props = {
  candles: Candle[] | null;
  history?: Candle[] | null;
  path?: number[] | null;
  comparison?: {
    candles: Candle[] | null;
    path: number[] | null;
    date: string;
  } | null;
  single?: boolean;
  type: "candle" | "line";
  title: string;
  averages?: boolean;
};
export function Chart({
  candles,
  history,
  path,
  comparison,
  single = false,
  type,
  title,
  averages = false,
}: Props) {
  const [cursor, setCursor] = useState<{ index: number; y: number | null } | null>(null);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => { setCursor(null); }, [candles, path, comparison, type, mobile]);
  const width = mobile ? 520 : single ? 1080 : 650,
    height = mobile ? 310 : single ? 365 : 355;
  const raw = candles?.map((p) => p.close) ?? path?.map((v) => 100 * (1 + v));
  const comparisonRaw =
    comparison?.candles?.map((p) => p.close) ??
    comparison?.path?.map((v) => 100 * (1 + v));
  if (!raw?.length)
    return (
      <div className="empty-chart" role="status">
        이 구간의 차트 데이터가 없습니다.
      </div>
    );
  if (comparison && !comparisonRaw)
    return (
      <div className="empty-chart" role="status">
        이 과거 구간의 비교 시계열이 제공되지 않았어요.
      </div>
    );
  const isRelative = Boolean(comparison) || !candles;
  const values = isRelative ? normalized(raw) : raw;
  const past = comparisonRaw ? normalized(comparisonRaw) : null;
  const ma =
    averages && !isRelative
      ? [5, 20, 60, 120].map((n) =>
          movingAverage(history?.map((p) => p.close) ?? raw, n).slice(
            -values.length,
          ),
        )
      : [];
  const ranges = past
    ? [...values, ...past]
    : candles
      ? [
          ...candles.flatMap((p) => [p.low, p.high]),
          ...ma.flat().filter((v): v is number => v !== null),
        ]
      : values;
  const gap = Math.max(...ranges) - Math.min(...ranges) || 1;
  const min = Math.min(...ranges) - gap * 0.12,
    max = Math.max(...ranges) + gap * 0.12;
  const y = (v: number) => 24 + ((max - v) / (max - min)) * (height - 54);
  const { x, barWidth } = geometry(values.length, width, single);
  const line = (series: (number | null)[]) =>
    series
      .map((v, i) =>
        v === null
          ? ""
          : `${i === 0 || series[i - 1] === null ? "M" : "L"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`,
      )
      .join(" ");
  const index = cursor === null ? null : Math.min(values.length - 1, cursor.index);
  const volumeMax = Math.max(1, ...(candles?.map((p) => p.volume) ?? [1]));
  const label = (i: number) =>
    isRelative ? `D${i - values.length + 1}` : candles![i].date.slice(5);
  function moveCursor(event: PointerEvent<SVGSVGElement>, priceArea: boolean) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    // Account for SVG scaling and letterboxing, including fullscreen layouts.
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const top = priceArea ? 24 : 1, bottom = priceArea ? height - 30 : 97;
    if (point.x < 22 || point.x > width - 72 || point.y < top || point.y > bottom) {
      setCursor(null);
      return;
    }
    let nearest = 0;
    for (let i = 1; i < values.length; i++)
      if (Math.abs(x(i) - point.x) < Math.abs(x(nearest) - point.x)) nearest = i;
    setCursor({ index: nearest, y: priceArea ? point.y : null });
  }
  const cursorValue = cursor?.y == null ? null : max - (cursor.y - 24) / (height - 54) * (max - min);
  const labelStyle = { fill: '#fff', fontSize: mobile ? 14 : 12 };
  const quoteIndex = index ?? values.length - 1;
  const quote = candles?.[quoteIndex];
  const historyIndex = quote ? history?.findIndex(p => p.date === quote.date) ?? -1 : -1;
  const previous = quoteIndex > 0 ? candles?.[quoteIndex - 1] : historyIndex > 0 ? history?.[historyIndex - 1] : undefined;
  const change = quote && previous ? quote.close - previous.close : null;
  const changeRate = change !== null && previous ? change / previous.close * 100 : null;
  return (
    <div className="chart" data-testid="chart" data-count={values.length}>
      {quote ? <div className="quote-readout" data-testid="quote-readout" data-date={quote.date} aria-label={`${title} ${quote.date} 시세`} title={`${quote.date} · 보정가격 USD · 등락은 전 거래일 종가 대비`} aria-live="off">
        {([['시', '시가', quote.open], ['고', '고가', quote.high], ['저', '저가', quote.low], ['종', '종가', quote.close]] as const).map(([short, label, value]) =>
          <span className="quote-item" key={short} aria-label={label}><span>{short}</span><b>{price(value)}</b></span>)}
        <span className={`quote-change ${tone(change)}`} data-testid="quote-change" aria-label="전 거래일 대비 등락">
          {change === null || changeRate === null ? '전일 대비 —' : `${change > 0 ? '▲' : change < 0 ? '▼' : '−'} ${price(Math.abs(change))} (${changeRate > 0 ? '+' : changeRate < 0 ? '−' : ''}${Math.abs(changeRate).toFixed(2)}%)`}
        </span>
        <span className="quote-item" aria-label="거래량"><span>거</span><b>{quote.volume.toLocaleString('en-US')}</b></span>
      </div> : <div className="chart-readout" aria-live="off">
        {index === null ? (
          <span>
            시작 종가 = 100 · 상대 거래일 정렬
          </span>
        ) : (
          <span>
            {label(index)} · 지수 <b>{price(values[index])}</b>
          </span>
        )}
      </div>}
      {past && <div className="chart-readout"><span>시작 종가 = 100 · 상대 거래일 정렬</span><span className="past">┄ 과거 {comparison?.date}</span></div>}
      {averages && !isRelative && (
        <div className="ma-legend">
          이동평균　
          {[5, 20, 60, 120]
            .filter((_, i) => ma[i]?.some(v => v !== null))
            .map((n, i) => (
              <span
                key={n}
                style={{
                  color: ["#61c943", "#ff5965", "#ff9b43", "#ac6eef"][i],
                }}
              >
                {n}　
              </span>
            ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} ${isRelative ? "정규화 선" : type === "candle" ? "캔들" : "선"} 차트`}
        onPointerLeave={() => setCursor(null)}
        onPointerMove={(event) => moveCursor(event, true)}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const v = max - (i / 4) * (max - min);
          return (
            <g key={i}>
              <path d={`M22 ${y(v)}H${width - 72}`} stroke="#edf0f3" />
              <text x={width - 62} y={y(v) + 4}>
                {v.toFixed(2)}
              </text>
            </g>
          );
        })}
        {isRelative || type === "line" ? (
          <path
            data-testid="price-line"
            d={line(values)}
            stroke="#2584ff"
            strokeWidth="2"
            fill="none"
          />
        ) : (
          candles!.map((p, i) => (
            <g
              key={p.date}
              fill={p.close >= p.open ? "#f04452" : "#2584ff"}
              stroke={p.close >= p.open ? "#f04452" : "#2584ff"}
            >
              <path d={`M${x(i)} ${y(p.high)}V${y(p.low)}`} />
              <rect
                data-testid="candle"
                x={x(i) - barWidth / 2}
                y={Math.min(y(p.open), y(p.close))}
                width={barWidth}
                height={Math.max(1, Math.abs(y(p.open) - y(p.close)))}
                stroke="none"
              />
            </g>
          ))
        )}
        {ma.map((series, i) => (
          <path
            key={i}
            d={line(series)}
            fill="none"
            stroke={["#61c943", "#ff5965", "#ff9b43", "#ac6eef"][i]}
            strokeWidth="1.5"
          />
        ))}
        {past && (
          <path
            data-testid="comparison-line"
            d={line(past)}
            stroke="#9254de"
            strokeWidth="2"
            strokeDasharray="7 5"
            fill="none"
          />
        )}
        {index !== null && (
          <g pointerEvents="none">
            <path
              d={`M${x(index)} 24V${height - 30}`}
              stroke="#b9bec8"
              strokeDasharray="4 4"
            />
            {cursor?.y != null && cursorValue !== null && <>
              <path d={`M22 ${cursor.y}H${width - 72}`} stroke="#b9bec8" strokeDasharray="4 4" />
              <g data-testid="crosshair-price" aria-label={isRelative ? '마우스 위치 지수' : '마우스 위치 가격'}>
                <path d={`M${width - 72} ${cursor.y}l8 -11H${width}v22H${width - 64}Z`} fill="#93979c" />
                <text x={width - 33} y={cursor.y} textAnchor="middle" dominantBaseline="central" style={labelStyle}>{price(cursorValue)}</text>
              </g>
            </>}
          </g>
        )}
      </svg>
      {candles ? (
        <>
          <div className="volume-label">
            {past ? "현재 구간 " : ""}거래량 · 주{!single && " · 독립 축"}
          </div>
          <svg
            viewBox={`0 0 ${width} 105`}
            role="img"
            aria-label={`${title} 거래량`}
            onPointerMove={(event) => moveCursor(event, false)}
            onPointerLeave={() => setCursor(null)}
          >
            <path d={`M22 1H${width - 72}`} stroke="#e8eaee" />
            {candles.map((p, i) => {
              const h = (p.volume / volumeMax) * 83;
              return (
                <rect
                  data-testid="volume-bar"
                  key={p.date}
                  x={x(i) - barWidth / 2}
                  y={97 - h}
                  width={barWidth}
                  height={h}
                  fill={p.close >= p.open ? "#f04452" : "#2584ff"}
                />
              );
            })}
            <text x={width - 62} y="16">
              {(volumeMax / 1e6).toFixed(1)}M
            </text>
            {index !== null && <path d={`M${x(index)} 1V97`} stroke="#b9bec8" strokeDasharray="4 4" pointerEvents="none" />}
          </svg>
        </>
      ) : (
        <div className="volume-unavailable">
          가격·거래량 API 연결 전이에요. 현재는 분석 API의 누적 수익률로 흐름만
          표시합니다.
        </div>
      )}
      <svg viewBox={`0 0 ${width} 26`} role="img" aria-label={`${title} 날짜 축`}>
        {values.map((_, i) => i % Math.max(1, Math.ceil(values.length / 6)) === 0 &&
          <text key={i} x={x(i)} y="16" textAnchor="middle">{label(i)}</text>)}
        {index !== null && <g data-testid="crosshair-date" pointerEvents="none">
          <rect x={Math.max(0, Math.min(width - 112, x(index) - 56))} y="1" width="112" height="24" rx="2" fill="#93979c" />
          <text x={Math.max(56, Math.min(width - 56, x(index)))} y="13" dominantBaseline="central" textAnchor="middle" style={labelStyle}>{candles?.[index].date ?? label(index)}</text>
        </g>}
      </svg>
    </div>
  );
}
