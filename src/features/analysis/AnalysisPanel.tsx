import type { Analysis, Case } from "../../lib/api";
import { IndicatorMetrics } from "./IndicatorMetrics";
import { CasesTable } from "./CasesTable";
import { ActualOutcome } from "./ActualOutcome";
import type { Indicator } from "./indicators";

type Props = {
  result: Analysis;
  enabled: Indicator[];
  onCompare: () => void;
  onHover: (c: Case | null) => void;
  onSelect: (c: Case) => void;
};

/** AI 분석 결과 패널: 지표 카드 → 유사 사례 표 → 실제 결과 순서로 구성한다. */
export function AnalysisPanel({
  result,
  enabled,
  onCompare,
  onHover,
  onSelect,
}: Props) {
  return (
    <>
      <IndicatorMetrics risk={result.risk} enabled={enabled} />
      <p className="footnote">
        급락 확률은 보정에 한계가 있으며, 수익률 범위는 미래의 신뢰구간이나 보장
        범위가 아닙니다.
      </p>
      <CasesTable
        result={result}
        onCompare={onCompare}
        onHover={onHover}
        onSelect={onSelect}
      />
      <ActualOutcome actual={result.actual} />
      {result.query.date < "2022-01-01" && (
        <p className="notice">
          현재 CNN은 2021년까지 학습된 고정 모델입니다. 이 결과를 당시 이용
          가능했던 모델의 예측으로 해석하지 마세요.
        </p>
      )}
      <p className="footnote">{result.disclaimer}</p>
    </>
  );
}
