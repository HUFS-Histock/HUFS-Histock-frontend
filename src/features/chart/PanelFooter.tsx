type Props = {
  displayDate: string | undefined;
  hasPrice: boolean;
  source: "live" | "snapshot";
};

export function PanelFooter({ displayDate, hasPrice, source }: Props) {
  return (
    <footer>
      <span>SPY · USD · 일별 데이터 · {displayDate ?? "—"} 기준</span>
      <span>
        가격·거래량: {hasPrice ? "로컬 저장본" : "미제공"} / 분석:{" "}
        {source === "live" ? "API" : "저장본"}
      </span>
    </footer>
  );
}
