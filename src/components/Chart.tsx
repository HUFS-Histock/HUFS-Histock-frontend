import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Candle } from "../api";
import { dateTicks, geometry, movingAverage, normalized, price, tone, zoomRange } from "../chart";

type Viewport = { key: string; start: number; count: number; animate?: boolean };

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
  resetKey?: number;
};
export function Chart({
  candles: sourceCandles,
  history,
  path,
  comparison,
  single = false,
  type,
  title,
  averages = false,
  resetKey = 0,
}: Props) {
  const clipId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; start: number; key: string } | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [animated, setAnimated] = useState<Viewport | null>(null);
  const displayed = useRef<Viewport | null>(null);
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
  useEffect(() => { setCursor(null); }, [sourceCandles, path, comparison, type, mobile]);
  const width = mobile ? 520 : single ? 1080 : 650,
    height = mobile ? 310 : single ? 365 : 355;
  const fullRaw = sourceCandles?.map((p) => p.close) ?? path?.map((v) => 100 * (1 + v));
  const total = fullRaw?.length ?? 0;
  const dataKey = `${resetKey}:${sourceCandles?.map(p => p.date).join(',') ?? path?.join(',')}:${comparison?.date ?? ''}`;
  const target = viewport?.key === dataKey ? viewport : { key: dataKey, start: 0, count: total, animate: true };
  const view = target.animate && animated?.key === dataKey ? animated : target;
  useEffect(() => {
    displayed.current = view;
  });
  useEffect(() => {
    const from = displayed.current;
    const to = { key: dataKey, start: target.start, count: target.count };
    if (!target.animate || !from || from.key !== dataKey || from.count === to.count ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimated(to);
      return;
    }
    let frame = 0;
    const began = performance.now();
    function step(now: number) {
      const progress = Math.max(0, Math.min(1, (now - began) / 180));
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(progress === 1 ? to : {
        key: dataKey,
        start: from!.start + (to.start - from!.start) * eased,
        count: from!.count + (to.count - from!.count) * eased,
      });
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [dataKey, target.start, target.count, target.animate]);
  const { count } = view;
  const position = view.start;
  const start = Math.floor(position);
  const fraction = position - start;
  const end = Math.min(total, Math.ceil(position + count));
  const zoomed = count < total;
  function zoom(factor: number, anchor = .5) {
    if (!total) return;
    setCursor(null);
    setViewport(previous => {
      const current = previous?.key === dataKey ? previous : { start: 0, count: total };
      return { key: dataKey, animate: true, ...zoomRange(total, current.start, current.count, factor, anchor) };
    });
  }
  function pan(value: number, relative = false) {
    setCursor(null);
    setViewport(previous => {
      const current = previous?.key === dataKey && !previous.animate
        ? previous : displayed.current?.key === dataKey ? displayed.current : view;
      return { key: dataKey, count: current.count, animate: false,
        start: Math.max(0, Math.min(total - current.count, relative ? current.start + value : value)) };
    });
  }
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    let wheelDelta = 0;
    function wheel(event: WheelEvent) {
      const svg = event.target instanceof Element ? event.target.closest<SVGSVGElement>('svg[data-zoom-plot]') : null;
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix || (!event.deltaY && !event.deltaX)) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const isPrice = svg.dataset.zoomPlot === 'price';
      if (point.x < 22 || point.x > width - 72 || point.y < (isPrice ? 24 : 1) || point.y > (isPrice ? height - 30 : 97)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      if (!event.ctrlKey && (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))) {
        const delta = (event.deltaX || event.deltaY) * unit;
        wheelDelta = 0;
        pan(delta / matrix.a / ((width - 94) / (displayed.current?.count ?? total)), true);
        return;
      }
      const pixels = event.deltaY * unit;
      if (Math.sign(pixels) !== Math.sign(wheelDelta)) wheelDelta = 0;
      wheelDelta += pixels;
      if (Math.abs(wheelDelta) < 24) return;
      zoom(Math.exp(Math.max(-160, Math.min(160, wheelDelta)) * .003), (point.x - 22) / (width - 94));
      wheelDelta = 0;
    }
    chart.addEventListener('wheel', wheel, { passive: false });
    return () => chart.removeEventListener('wheel', wheel);
  }, [dataKey, total, width, height]);
  const comparisonRaw =
    comparison?.candles?.map((p) => p.close) ??
    comparison?.path?.map((v) => 100 * (1 + v));
  if (!fullRaw?.length)
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
  const candles = sourceCandles?.slice(start, end) ?? null;
  const isRelative = Boolean(comparison) || !sourceCandles;
  // Compute indicators and normalization over the full input, then crop only the view.
  const values = (isRelative ? normalized(fullRaw) : fullRaw).slice(start, end);
  const past = comparisonRaw ? normalized(comparisonRaw).slice(start, end) : null;
  const ma =
    averages && !isRelative
      ? [5, 20, 60, 120].map((n) =>
          movingAverage(history?.map((p) => p.close) ?? fullRaw, n).slice(-total).slice(start, end),
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
  const { x: baseX, barWidth } = geometry(count, width, single, zoomed);
  const x = (i: number) => baseX(i) - fraction * (width - 94) / count;
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
  const ticks = sourceCandles && !isRelative
    ? dateTicks(sourceCandles.map(p => p.date), start, count)
    : values.flatMap((_, i) => i % (count <= 15 ? 1 : 5) === 0
      ? [{ index: i, text: `D${start + i - total + 1}` }] : []);
  function beginDrag(event: PointerEvent<SVGSVGElement>) {
    if (!zoomed || event.button !== 0) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const priceArea = event.currentTarget.dataset.zoomPlot === 'price';
    if (point.x < 22 || point.x > width - 72 || point.y < (priceArea ? 24 : 1) || point.y > (priceArea ? height - 30 : 97)) return;
    drag.current = { id: event.pointerId, x: point.x, start: position, key: dataKey };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCursor(null);
  }
  function endDrag(event: PointerEvent<SVGSVGElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const label = (i: number) =>
    isRelative ? `D${start + i - total + 1}` : candles![i].date.slice(5);
  function moveCursor(event: PointerEvent<SVGSVGElement>, priceArea: boolean) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    // Account for SVG scaling and letterboxing, including fullscreen layouts.
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (drag.current?.id === event.pointerId) {
      if (drag.current.key === dataKey) pan(drag.current.start - (point.x - drag.current.x) / ((width - 94) / count));
      return;
    }
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
  const previous = start + quoteIndex > 0 ? sourceCandles?.[start + quoteIndex - 1] : historyIndex > 0 ? history?.[historyIndex - 1] : undefined;
  const change = quote && previous ? quote.close - previous.close : null;
  const changeRate = change !== null && previous ? change / previous.close * 100 : null;
  return (
    <div ref={chartRef} className="chart" data-testid="chart" data-count={count} data-start={start} data-position={position} data-total={total} data-zoomed={zoomed}
      tabIndex={zoomed ? 0 : undefined} role="region" aria-label={`${title} 차트 탐색`}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !zoomed) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        pan(event.key === 'Home' ? 0 : event.key === 'End' ? total - count : position + (event.key === 'ArrowLeft' ? -1 : 1));
      }}>
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
        data-zoom-plot="price"
        onPointerDown={beginDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => { drag.current = null; }}
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
        <defs><clipPath id={`${clipId}-price`}><rect x="22" y="24" width={width - 94} height={height - 54} /></clipPath></defs>
        <g clipPath={zoomed ? `url(#${clipId}-price)` : undefined}>
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
        </g>
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
            data-zoom-plot="volume"
            onPointerDown={beginDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={() => { drag.current = null; }}
            viewBox={`0 0 ${width} 105`}
            role="img"
            aria-label={`${title} 거래량`}
            onPointerMove={(event) => moveCursor(event, false)}
            onPointerLeave={() => setCursor(null)}
          >
            <path d={`M22 1H${width - 72}`} stroke="#e8eaee" />
            <defs><clipPath id={`${clipId}-volume`}><rect x="22" y="1" width={width - 94} height="96" /></clipPath></defs>
            <g clipPath={zoomed ? `url(#${clipId}-volume)` : undefined}>
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
            </g>
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
        <defs><clipPath id={`${clipId}-dates`}><rect width={width - 72} height="26" /></clipPath></defs>
        <g clipPath={`url(#${clipId}-dates)`}>
        {ticks.map(tick => <text data-testid="date-tick" key={tick.index} x={x(tick.index)} y="16" textAnchor="middle">{tick.text}</text>)}
        </g>
        {index !== null && <g data-testid="crosshair-date" pointerEvents="none">
          <rect x={Math.max(0, Math.min(width - 112, x(index) - 56))} y="1" width="112" height="24" rx="2" fill="#93979c" />
          <text x={Math.max(56, Math.min(width - 56, x(index)))} y="13" dominantBaseline="central" textAnchor="middle" style={labelStyle}>{candles?.[index].date ?? label(index)}</text>
        </g>}
      </svg>
      <div className="chart-zoom-controls" role="group" aria-label={`${title} 차트 확대·축소`}>
        <span>휠 확대·축소 · 드래그/가로 스크롤 이동 · {Math.round(count)}/{total}거래일 표시</span>
        <button type="button" aria-label="차트 확대" disabled={count <= Math.min(5, total)} onClick={() => zoom(.8)}>＋</button>
        <button type="button" aria-label="차트 축소" disabled={!zoomed} onClick={() => zoom(1.25)}>−</button>
        <button type="button" aria-label="차트 배율 초기화" disabled={!zoomed} onClick={() => { setViewport(null); setCursor(null); }}>원래 구간</button>
      </div>
    </div>
  );
}
