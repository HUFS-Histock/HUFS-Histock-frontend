import { SiteHeader } from "./features/header/SiteHeader";
import { MarketNav } from "./features/header/MarketNav";
import { InstrumentSidebar } from "./features/instrument/InstrumentSidebar";
import { WorkspacePanel } from "./features/workspace/WorkspacePanel";
import { useAnalysis } from "./features/analysis/useAnalysis";
import { useChartView } from "./features/chart/useChartView";

export default function App() {
  const analysis = useAnalysis();
  const chart = useChartView(analysis.snapshot, analysis.result);
  return (
    <>
      <SiteHeader />
      <MarketNav />
      <div className="layout">
        <InstrumentSidebar
          snapshot={analysis.snapshot}
          displayDate={chart.displayDate}
        />
        <WorkspacePanel analysis={analysis} chart={chart} />
      </div>
    </>
  );
}
