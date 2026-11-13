import { useEffect, useRef, useState } from "react";
import { zoomRange } from "./chartMath";

type Viewport = { key: string; start: number; count: number; animate?: boolean };

type Options = {
  /** 표시 대상 전체 개수 (줌 범위의 상한) */
  total: number;
  /** 데이터 교체 식별자 — 바뀌면 뷰포트를 초기화한다 */
  dataKey: string;
  width: number;
  height: number;
  /** 줌/팬 직전 호출 (커서 초기화 등) */
  onNavigate: () => void;
};

/**
 * 차트 뷰포트 상태: 확대·축소, 좌우 이동(팬), 전환 애니메이션, 휠 제스처.
 * 데이터가 바뀌면(dataKey) 뷰포트를 전체 구간으로 되돌린다.
 */
export function useChartViewport({ total, dataKey, width, height, onNavigate }: Options) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [animated, setAnimated] = useState<Viewport | null>(null);
  const displayed = useRef<Viewport | null>(null);
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

  function zoom(factor: number, anchor = .5) {
    if (!total) return;
    onNavigate();
    setViewport(previous => {
      const current = previous?.key === dataKey ? previous : { start: 0, count: total };
      return { key: dataKey, animate: true, ...zoomRange(total, current.start, current.count, factor, anchor) };
    });
  }
  function pan(value: number, relative = false) {
    onNavigate();
    setViewport(previous => {
      const current = previous?.key === dataKey && !previous.animate
        ? previous : displayed.current?.key === dataKey ? displayed.current : view;
      return { key: dataKey, count: current.count, animate: false,
        start: Math.max(0, Math.min(total - current.count, relative ? current.start + value : value)) };
    });
  }
  /** 배율을 초기화하고 전체 구간으로 되돌린다. */
  function reset() {
    onNavigate();
    setViewport(null);
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

  return { chartRef, view, zoom, pan, reset };
}
