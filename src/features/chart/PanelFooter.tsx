type Props = {
  displayDate: string | undefined;
  hasPrice: boolean;
  source: "live" | "snapshot";
  /** 분석 결과가 있거나 로딩 중이어야 출처를 API로 표시한다. */
  hasAnalysis: boolean;
};

export function PanelFooter({
  displayDate,
  hasPrice,
  source,
  hasAnalysis,
}: Props) {
  return (
    <footer>
      <span>SPY · USD · 일별 데이터 · {displayDate ?? "—"} 기준</span>
      <span>
        가격·거래량: {hasPrice ? "로컬 저장본" : "미제공"} / 분석:{" "}
        {source === "snapshot" ? "저장본" : hasAnalysis ? "API" : "미제공"}
      </span>
    </footer>
  );
}
