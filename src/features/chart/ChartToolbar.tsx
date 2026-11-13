import { useEffect, useRef, useState } from "react";
import { indicators } from "../analysis/indicators";
import type { Indicator } from "../analysis/indicators";

type Props = {
  picker: boolean;
  onTogglePicker: (open: boolean) => void;
  showAI: boolean;
  enabled: Indicator[];
  onApplyIndicators: (next: Indicator[]) => void;
  chartType: "candle" | "line";
  onChartTypeChange: (type: "candle" | "line") => void;
  canCandle: boolean;
  onToggleFullscreen: () => void;
};

export function ChartToolbar({
  picker,
  onTogglePicker,
  showAI,
  enabled,
  onApplyIndicators,
  chartType,
  onChartTypeChange,
  canCandle,
  onToggleFullscreen,
}: Props) {
  const [draft, setDraft] = useState<Indicator[]>(enabled);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const closePicker = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (picker) closePicker.current?.focus();
  }, [picker]);
  const close = () => {
    onTogglePicker(false);
    pickerButton.current?.focus();
  };
  return (
    <div className="toolbar">
      <div className="segmented">
        <button className="active" aria-pressed="true">
          일
        </button>
        <button disabled title="현재는 일봉만 지원합니다">
          주
        </button>
        <button disabled title="현재는 일봉만 지원합니다">
          월
        </button>
      </div>
      <div className="toolbar-right">
        <button
          ref={pickerButton}
          aria-expanded={picker}
          aria-controls="indicator-picker"
          className={showAI ? "active" : ""}
          onClick={() => {
            setDraft(enabled);
            onTogglePicker(!picker);
          }}
        >
          ⌁ 보조지표{showAI ? ` ${enabled.length}` : ""}
        </button>
        <button
          aria-pressed={chartType === "candle"}
          className={chartType === "candle" ? "active" : ""}
          onClick={() => onChartTypeChange("candle")}
          disabled={!canCandle}
        >
          캔들
        </button>
        <button
          aria-pressed={chartType === "line"}
          className={chartType === "line" ? "active" : ""}
          onClick={() => onChartTypeChange("line")}
        >
          선
        </button>
        <button aria-label="차트 전체 화면" onClick={onToggleFullscreen}>
          ⛶
        </button>
      </div>
      {picker && (
        <div
          className="indicator-picker"
          id="indicator-picker"
          role="dialog"
          aria-label="보조지표 선택"
        >
          <div className="picker-title">
            <b>보조지표</b>
            <button
              ref={closePicker}
              onClick={close}
              aria-label="보조지표 선택 닫기"
            >
              ×
            </button>
          </div>
          <span className="pill">HISTOCK AI</span>
          <h3>과거의 비슷한 시장을 함께 비교</h3>
          <p>선택한 지표를 차트 아래에 표시합니다.</p>
          {indicators.map((i) => (
            <label key={i.key}>
              <input
                type="checkbox"
                checked={draft.includes(i.key)}
                onChange={(event) =>
                  setDraft(
                    event.target.checked
                      ? [...draft, i.key]
                      : draft.filter((key) => key !== i.key),
                  )
                }
              />
              {i.label}
            </label>
          ))}
          <button
            className="apply active"
            disabled={!draft.length}
            onClick={() => {
              onApplyIndicators(draft);
              close();
            }}
          >
            차트에 AI 분석 추가
          </button>
        </div>
      )}
    </div>
  );
}
