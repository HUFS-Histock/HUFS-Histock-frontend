import type { Case } from "../../lib/api";

type Props = {
  tab: string;
  selected: Case | null;
  selectedRank: number;
  displayDate: string | undefined;
  onSelectTab: (tab: string) => void;
  onBackToSingle: () => void;
};

export function PanelHeading({
  tab,
  selected,
  selectedRank,
  displayDate,
  onSelectTab,
  onBackToSingle,
}: Props) {
  return selected ? (
    <div className="split-heading">
      <button onClick={onBackToSingle}>← 단일 차트로</button>
      <h2>
        Top {selectedRank} · {selected.date} ↔ {displayDate}
      </h2>
    </div>
  ) : (
    <div className="tabs" role="group" aria-label="종목 화면">
      {[
        ["chart", "차트 · 시세"],
        ["info", "종목정보"],
        ["guide", "분석 안내"],
      ].map(([id, label]) => (
        <button aria-pressed={tab === id} key={id} onClick={() => onSelectTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
