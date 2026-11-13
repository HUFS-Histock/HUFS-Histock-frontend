import { useEffect, useRef, useState } from "react";
import type { Case } from "../../lib/api";
import { PanelHeading } from "./PanelHeading";
import { InfoPage } from "./InfoPage";
import { GuidePage } from "./GuidePage";
import { ChartToolbar } from "../chart/ChartToolbar";
import { CaseStrip } from "../chart/CaseStrip";
import { Chart } from "../chart/Chart";
import { SplitComparison } from "../chart/SplitComparison";
import { RangeControls } from "../chart/RangeControls";
import { PanelFooter } from "../chart/PanelFooter";
import { AnalysisSection } from "../analysis/AnalysisSection";
import type { Indicator } from "../analysis/indicators";
import type { useAnalysis } from "../analysis/useAnalysis";
import type { useChartView } from "../chart/useChartView";

type Props = {
  analysis: ReturnType<typeof useAnalysis>;
  chart: ReturnType<typeof useChartView>;
};

/** 메인 워크스페이스: 탭 전환과 차트·AI 분석 패널을 구성한다. */
export function WorkspacePanel({ analysis, chart }: Props) {
  const [tab, setTab] = useState("chart");
  const [showAI, setShowAI] = useState(false),
    [picker, setPicker] = useState(false);
  const content = useRef<HTMLElement>(null);
  const caseStrip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicker(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);
  useEffect(() => {
    if (!chart.selected) return;
    caseStrip.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [chart.selected]);

  function applyIndicators(next: Indicator[]) {
    analysis.setEnabled(next);
    setShowAI(true);
    chart.compareTop5();
  }
  function selectCase(c: Case) {
    chart.selectCase(c);
    setTab("chart");
  }
  function toggleFullscreen() {
    if (document.fullscreenElement)
      void document
        .exitFullscreen()
        .catch(() => analysis.setError("전체 화면을 종료하지 못했습니다."));
    else
      void content.current
        ?.requestFullscreen()
        .catch(() =>
          analysis.setError(
            "이 브라우저에서는 전체 화면을 사용할 수 없습니다.",
          ),
        );
  }

  return (
    <main ref={content} className="workspace">
      <section className="panel">
        <PanelHeading
          tab={tab}
          selected={chart.selected}
          selectedRank={chart.selectedRank}
          displayDate={chart.displayDate}
          onSelectTab={setTab}
          onBackToSingle={chart.clearSelection}
        />
        {tab === "info" && !chart.selected ? (
          <InfoPage />
        ) : tab === "guide" && !chart.selected ? (
          <GuidePage />
        ) : (
          <div className="panel-body">
            <ChartToolbar
              picker={picker}
              onTogglePicker={setPicker}
              showAI={showAI}
              enabled={analysis.enabled}
              onApplyIndicators={applyIndicators}
              chartType={chart.chartType}
              onChartTypeChange={chart.setChartType}
              canCandle={!!chart.current20}
              onToggleFullscreen={toggleFullscreen}
            />
            <div className="ohlc">
              <time>{chart.displayDate ?? "데이터 조회 중"}</time>
              <span className="snapshot-label">
                {chart.last ? "시세 저장본 · 실시간 아님" : "시세 데이터 미제공"}
              </span>
            </div>
            {(chart.compare || chart.selected) && analysis.result && (
              <CaseStrip
                cases={analysis.result.cases}
                selected={chart.selected}
                hovered={chart.hovered}
                onHover={chart.hoverCase}
                onSelect={selectCase}
                stripRef={caseStrip}
              />
            )}
            {chart.selected ? (
              <SplitComparison
                selected={chart.selected}
                displayDate={chart.displayDate}
                snapshot={analysis.snapshot}
                result={analysis.result}
                chartType={chart.chartType}
              />
            ) : (
              <>
                <Chart
                  resetKey={chart.resetKey}
                  candles={chart.usableCandles}
                  history={chart.historyCandles}
                  path={analysis.result?.query.path}
                  comparison={
                    chart.hovered
                      ? {
                          candles: chart.pastCandles(chart.hovered),
                          path: chart.hovered.path,
                          date: chart.hovered.date,
                        }
                      : null
                  }
                  single
                  type={chart.chartType}
                  title="현재"
                  averages={chart.chartCount > 20 && !chart.hovered}
                />
                <RangeControls
                  available={chart.availablePeriods}
                  activeValue={chart.compare || chart.hovered ? 20 : chart.activePeriod}
                  onPick={chart.pickPeriod}
                />
              </>
            )}
            {analysis.snapshotError && (
              <p className="notice">{analysis.snapshotError}</p>
            )}
            {showAI && !chart.selected && (
              <AnalysisSection
                health={analysis.health}
                methods={analysis.methods}
                busy={analysis.busy}
                error={analysis.error}
                result={analysis.result}
                date={analysis.date}
                method={analysis.method}
                source={analysis.source}
                snapshot={analysis.snapshot}
                enabled={analysis.enabled}
                onDateChange={analysis.setDate}
                onMethodChange={analysis.setMethod}
                onSearch={(d, m) => void analysis.load(d, m)}
                onUseSnapshot={analysis.applySnapshot}
                onHide={() => {
                  setShowAI(false);
                  chart.resetComparison();
                }}
                onCompare={() => {
                  chart.enterCompare();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onHover={chart.hoverCase}
                onSelect={selectCase}
              />
            )}
            <PanelFooter
              displayDate={chart.displayDate}
              hasPrice={!!chart.last}
              source={analysis.source}
            />
          </div>
        )}
      </section>
    </main>
  );
}
