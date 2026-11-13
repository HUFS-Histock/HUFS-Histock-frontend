import { useEffect, useState } from "react";
import type { Analysis, Case, Snapshot } from "../../lib/api";
import { windowFor } from "./chartMath";

/**
 * 차트 화면 상태: 캔들/선, 조회 기간, Top 5 비교, 케이스 호버·선택.
 * 스냅숏과 분석 결과에서 파생되는 캔들 윈도우도 함께 계산한다.
 */
export function useChartView(
  snapshot: Snapshot | null,
  result: Analysis | null,
) {
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const [chartReset, setChartReset] = useState(0);
  const [period, setPeriod] = useState(120),
    [compare, setCompare] = useState(false);
  const [hovered, setHovered] = useState<Case | null>(null),
    [selected, setSelected] = useState<Case | null>(null);

  // 새 분석 결과가 도착하면 이전 결과의 비교 선택을 버린다.
  useEffect(() => {
    setSelected(null);
    setHovered(null);
  }, [result]);

  // Escape 키로 케이스 비교 선택을 해제한다.
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setHovered(null);
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  function clearSelection() {
    setSelected(null);
    setHovered(null);
  }
  function resetComparison(hideTop5 = true) {
    clearSelection();
    if (hideTop5) setCompare(false);
  }
  /** 보조지표 적용: 20거래일 창으로 되돌리고 Top 5 비교를 띄운다. */
  function compareTop5() {
    setPeriod(20);
    setChartReset((value) => value + 1);
    setCompare(true);
    clearSelection();
  }
  /** 분석 패널의 비교 버튼: 차트를 다시 그리고 비교 모드로 연다. */
  function enterCompare() {
    setChartReset((value) => value + 1);
    setCompare(true);
    setHovered(null);
  }
  function pickPeriod(n: number) {
    setPeriod(n);
    setChartReset((value) => value + 1);
    setCompare(false);
    setHovered(null);
  }
  function hoverCase(c: Case | null) {
    if (!selected) setHovered(c);
  }
  function selectCase(c: Case) {
    setSelected(c);
    setHovered(null);
    setCompare(true);
  }

  const displayDate = result?.query.date ?? snapshot?.dataDate;
  const current20 =
    snapshot && displayDate ? windowFor(snapshot.prices, displayDate) : null;
  const end = snapshot?.prices.findIndex((p) => p.date === displayDate) ?? -1;
  const last = end >= 0 ? snapshot!.prices[end] : null;
  const chartCount = hovered || compare || selected ? 20 : period;
  const chartCandles =
    snapshot && displayDate
      ? windowFor(snapshot.prices, displayDate, chartCount)
      : null;
  const historyCandles =
    snapshot && displayDate
      ? windowFor(snapshot.prices, displayDate, 240)
      : null;
  const pastCandles = (c: Case) =>
    snapshot ? windowFor(snapshot.prices, c.date) : null;
  const availablePeriods = [20, 60, 120].filter(
    (n) =>
      snapshot && displayDate && windowFor(snapshot.prices, displayDate, n),
  );
  const activePeriod = availablePeriods.includes(period) ? period : 20;
  const usableCandles =
    chartCandles ?? (chartCount !== 20 && !hovered ? current20 : null);
  const selectedRank =
    selected && result
      ? result.cases.findIndex((c) => c.date === selected.date) + 1
      : 0;

  return {
    chartType,
    setChartType,
    period,
    compare,
    hovered,
    selected,
    selectedRank,
    resetKey: chartReset,
    displayDate,
    current20,
    last,
    availablePeriods,
    activePeriod,
    chartCount,
    chartCandles,
    usableCandles,
    historyCandles,
    pastCandles,
    hoverCase,
    selectCase,
    compareTop5,
    enterCompare,
    pickPeriod,
    resetComparison,
    clearSelection,
  };
}
