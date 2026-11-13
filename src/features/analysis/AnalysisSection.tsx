import type {
  Analysis,
  Case,
  Health,
  Methods,
  Snapshot,
} from "../../lib/api";
import type { Indicator } from "./indicators";
import { AnalysisPanel } from "./AnalysisPanel";

type Props = {
  health: Health | null;
  methods: Methods | null;
  busy: boolean;
  error: string;
  result: Analysis | null;
  date: string;
  method: string;
  source: "live" | "snapshot";
  snapshot: Snapshot | null;
  enabled: Indicator[];
  onDateChange: (date: string) => void;
  onMethodChange: (method: string) => void;
  onSearch: (date?: string, method?: string) => void;
  onUseSnapshot: () => void;
  onHide: () => void;
  onCompare: () => void;
  onHover: (c: Case | null) => void;
  onSelect: (c: Case) => void;
};

export function AnalysisSection({
  health,
  methods,
  busy,
  error,
  result,
  date,
  method,
  source,
  snapshot,
  enabled,
  onDateChange,
  onMethodChange,
  onSearch,
  onUseSnapshot,
  onHide,
  onCompare,
  onHover,
  onSelect,
}: Props) {
  return (
    <section
      className="analysis-section"
      aria-label="AI 분석 결과"
      aria-busy={busy}
    >
      <div className="analysis-heading">
        <h2>
          <span>HISTOCK AI</span> 보조지표
        </h2>
        <button className="text-button" onClick={onHide}>
          지표 숨기기 ×
        </button>
      </div>
      <form
        className="analysis-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(date, method);
        }}
      >
        <label>
          기준일{" "}
          <input
            aria-label="분석 기준일"
            type="date"
            required
            min={health?.date_start}
            max={health?.date_end}
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={busy || !health || health.status !== "ok"}
          />
        </label>
        <label>
          분석 방식{" "}
          <select
            aria-label="분석 방식"
            value={method}
            onChange={(e) => onMethodChange(e.target.value)}
            disabled={busy || !methods}
          >
            {Object.keys(methods?.methods ?? { hybrid: "" }).map((key) => (
              <option key={key} value={key}>
                {(
                  {
                    hybrid: "하이브리드",
                    e7_cnn: "CNN 패턴",
                    summary: "통계 요약",
                  } as Record<string, string>
                )[key] ?? key}
              </option>
            ))}
          </select>
        </label>
        <button
          className="active"
          type="submit"
          disabled={busy || !health || health.status !== "ok"}
        >
          {busy ? "분석 중…" : "분석하기"}
        </button>
        <span className="source-label">
          {source === "snapshot" ? "저장된 예시 분석" : "백엔드 API 분석"}
        </span>
        {snapshot && source !== "snapshot" && (
          <button type="button" className="text-button" onClick={onUseSnapshot}>
            저장된 예시 보기
          </button>
        )}
        {source === "snapshot" && (
          <button type="button" onClick={() => onSearch()}>
            API 연결하기
          </button>
        )}
      </form>
      {health?.stale && source === "live" && (
        <p className="notice">
          데이터 갱신 지연 · {health.data_date} 기준 (
          {health.business_days_behind}거래일 지연). 오늘 시세를 반영한 분석이
          아닙니다.
        </p>
      )}
      {busy && (
        <div role="status" className="loading">
          <span className="spinner" />
          과거의 비슷한 시장을 찾고 있어요.
        </div>
      )}
      {error && (
        <div role="alert" className="error">
          <p>{error}</p>
          <button onClick={() => onSearch(date || undefined, method)}>
            다시 시도
          </button>
        </div>
      )}
      {result && !busy && (
        <>
          {result.query.requested !== result.query.date && (
            <p className="notice">
              요청일 {result.query.requested}은 휴장일이라 직전 거래일{" "}
              {result.query.date} 기준으로 분석했어요.
            </p>
          )}
          <div className="result-caption">
            분석 결과 기준일 <b>{result.query.date}</b> ·{" "}
            {result.method === "hybrid" ? "하이브리드" : result.method}
          </div>
          <AnalysisPanel
            result={result}
            enabled={enabled}
            onCompare={onCompare}
            onHover={onHover}
            onSelect={onSelect}
          />
        </>
      )}
    </section>
  );
}
