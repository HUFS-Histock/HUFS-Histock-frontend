import { useEffect, useRef, useState } from "react";
import {
  parseHealth,
  parseMethods,
  parseSnapshot,
  request,
  search,
} from "./api";
import type { Analysis, Case, Health, Methods, Snapshot } from "./api";
import { percent, price, tone, windowFor } from "./chart";
import { Chart } from "./components/Chart";
import { AnalysisPanel, indicators } from "./components/AnalysisPanel";
import type { Indicator } from "./components/AnalysisPanel";

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [methods, setMethods] = useState<Methods | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [date, setDate] = useState(""),
    [method, setMethod] = useState("hybrid");
  const [source, setSource] = useState<"live" | "snapshot">("live");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const [showAI, setShowAI] = useState(false),
    [picker, setPicker] = useState(false);
  const [enabled, setEnabled] = useState<Indicator[]>([
    "volatility",
    "crash",
    "returns",
  ]);
  const [draft, setDraft] = useState<Indicator[]>(enabled);
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const [period, setPeriod] = useState(120),
    [compare, setCompare] = useState(false);
  const [hovered, setHovered] = useState<Case | null>(null),
    [selected, setSelected] = useState<Case | null>(null);
  const [tab, setTab] = useState("chart");
  const activeRequest = useRef<AbortController | null>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const closePicker = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLElement>(null);

  function resetComparison(hideTop5 = true) {
    setSelected(null);
    setHovered(null);
    if (hideTop5) setCompare(false);
  }
  async function load(dateValue?: string, methodValue?: string) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError("");
    setSource("live");
    setResult(null);
    resetComparison(false);
    try {
      const [h, m] = await Promise.all([
        request("/api/v1/analysis/health", parseHealth, controller.signal),
        request("/api/v1/analysis/methods", parseMethods, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setHealth(h);
      setMethods(m);
      if (h.status !== "ok")
        throw new Error(
          "AI 분석 서버가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.",
        );
      const d = dateValue ?? h.date_end,
        chosen = methodValue ?? m.default;
      setDate(d);
      setMethod(chosen);
      const next = await search(d, chosen, controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "분석 중 오류가 발생했습니다. 다시 시도해 주세요.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const snapshotController = new AbortController();
    request("/snapshot.json", parseSnapshot, snapshotController.signal)
      .then(setSnapshot)
      .catch(() => {
        if (!snapshotController.signal.aborted)
          setSnapshotError(
            "저장된 가격·거래량 데이터가 없습니다. 분석 API의 상대 흐름은 조회할 수 있어요.",
          );
      });
    void load();
    return () => {
      snapshotController.abort();
      activeRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setHovered(null);
        setPicker(false);
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);
  useEffect(() => {
    if (picker) closePicker.current?.focus();
  }, [picker]);

  function useSnapshot() {
    if (!snapshot) return;
    activeRequest.current?.abort();
    setBusy(false);
    setError("");
    setSource("snapshot");
    setResult(snapshot.analysis);
    setDate(snapshot.analysis.query.date);
    setMethod(snapshot.analysis.method);
    resetComparison(false);
  }
  const displayDate = result?.query.date ?? snapshot?.dataDate;
  const current20 =
    snapshot && displayDate ? windowFor(snapshot.prices, displayDate) : null;
  const end = snapshot?.prices.findIndex((p) => p.date === displayDate) ?? -1;
  const last = end >= 0 ? snapshot!.prices[end] : null;
  const previous = end >= 1 ? snapshot!.prices[end - 1] : null;
  const change = last && previous ? last.close - previous.close : null;
  const changeRate =
    change !== null && previous ? change / previous.close : null;
  const chartCount = hovered || compare || selected ? 20 : period;
  const chartCandles =
    snapshot && displayDate
      ? windowFor(snapshot.prices, displayDate, chartCount)
      : null;
  const pastCandles = (c: Case) =>
    snapshot ? windowFor(snapshot.prices, c.date) : null;
  const hover = (c: Case | null) => {
    if (!selected) setHovered(c);
  };
  const select = (c: Case) => {
    setSelected(c);
    setHovered(null);
    setCompare(true);
    setTab("chart");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const availablePeriods = [20, 60, 120].filter(
    (n) =>
      snapshot && displayDate && windowFor(snapshot.prices, displayDate, n),
  );
  const activePeriod = availablePeriods.includes(period) ? period : 20;
  const usableCandles =
    chartCandles ?? (chartCount !== 20 && !hovered ? current20 : null);
  const close = () => {
    setPicker(false);
    pickerButton.current?.focus();
  };
  return (
    <>
      <header className="site-header">
        <a href="/" className="brand">
          HISTOCK
        </a>
        <div className="instrument-search">
          ⌕ <span>SPY · SPDR S&P 500</span>
        </div>
        <small>SPY · 20거래일 분석</small>
      </header>
      <nav className="market-nav">
        <b>미국 · ETF</b>
        <span>시장 국면 분석</span>
        <small>과거의 시장에서, 투자의 힌트를 찾다</small>
      </nav>
      <div className="layout">
        <aside className="sidebar">
          <small>‹ 미국 종목 / ETF</small>
          <div className="exchange">NYSE Arca</div>
          <div className="instrument">
            <span className="symbol-icon">SPY</span>
            <div>
              <small>SPY · 미국 ETF</small>
              <h1>SPDR S&P 500</h1>
            </div>
          </div>
          <div className="stock-price">
            {last ? price(last.close) : "—"} <span>USD</span>
          </div>
          <div className={`stock-change ${tone(change)}`}>
            {change !== null
              ? `${change < 0 ? "▼" : "▲"} ${price(Math.abs(change))} (${percent(changeRate, true)})`
              : "가격 데이터 미제공"}
          </div>
          <small>
            {displayDate ?? "—"} {last ? "저장된 종가 기준" : "분석 기준"}
          </small>
          <dl>
            <dt>시세정보</dt>
            {[
              ["시가", last?.open],
              ["고가", last?.high],
              ["저가", last?.low],
              ["전일 종가", previous?.close],
            ].map(([label, value]) => (
              <dd key={label}>
                <span>{label}</span>
                <b className={typeof value === "number" && previous ? tone(value - previous.close) : undefined}>{typeof value === "number" ? price(value) : "—"}</b>
              </dd>
            ))}
            <dd>
              <span>거래량</span>
              <b>{last?.volume.toLocaleString("en-US") ?? "—"}</b>
            </dd>
          </dl>
          <dl>
            <dt>종목정보</dt>
            <dd>
              <span>기초지수</span>
              <b>S&P 500</b>
            </dd>
            <dd>
              <span>거래 통화</span>
              <b>USD</b>
            </dd>
            <dd>
              <span>분석 대상</span>
              <b>SPY</b>
            </dd>
          </dl>
          <div className="sidebar-tip">
            <b>차트에 과거의 맥락을 더해요</b>
            <p>
              보조지표에서 AI 분석을 켜면
              <br />
              변동성 · 급락 위험 · 수익률 범위를
              <br />
              함께 살펴볼 수 있어요.
            </p>
          </div>
        </aside>
        <main ref={content} className="workspace">
          <section className="panel">
            {selected ? (
              <div className="split-heading">
                <button
                  onClick={() => {
                    setSelected(null);
                    setHovered(null);
                  }}
                >
                  ← 단일 차트로
                </button>
                <h2>
                  Top{" "}
                  {result!.cases.findIndex((c) => c.date === selected.date) + 1}{" "}
                  · {selected.date} ↔ {displayDate}
                </h2>
              </div>
            ) : (
              <div className="tabs" role="group" aria-label="종목 화면">
                {[
                  ["chart", "차트 · 시세"],
                  ["info", "종목정보"],
                  ["guide", "분석 안내"],
                ].map(([id, label]) => (
                  <button
                    aria-pressed={tab === id}
                    key={id}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {tab === "info" && !selected ? (
              <div className="text-page">
                <h2>SPDR S&P 500 ETF Trust</h2>
                <p>SPY는 S&P 500 지수의 흐름을 추종하는 미국 상장 ETF입니다.</p>
                <p>
                  현재 히스톡은 SPY의 과거 시장 국면을 분석합니다. 개별 종목
                  검색은 아직 지원하지 않습니다.
                </p>
              </div>
            ) : tab === "guide" && !selected ? (
              <div className="text-page">
                <h2>과거의 흐름을 현재의 참고로</h2>
                <p>
                  20거래일의 시장 특징을 바탕으로 과거 유사 구간을 찾습니다.
                  차트의 조회 기간을 바꿔도 모델 입력은 20거래일로 유지됩니다.
                </p>
                <p>
                  Top 5에 마우스를 올리거나 키보드로 포커스하면 시작값 100으로
                  정규화한 흐름을 비교합니다. 클릭하면 왼쪽에 과거, 오른쪽에
                  현재 구간이 표시됩니다.
                </p>
                <p>
                  수익률 분포와 위험 추정은 이후 20거래일 기준입니다. 유사도는
                  상승 확률이 아니며, 과거 통계가 미래 수익을 보장하지 않습니다.
                </p>
                <p>
                  가격·거래량은 로컬 저장본입니다. API에 가격 시계열이 없는
                  날짜는 누적 수익률 선만 표시하며 캔들과 거래량을 만들지
                  않습니다.
                </p>
              </div>
            ) : (
              <div className="panel-body">
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
                        setPicker(!picker);
                      }}
                    >
                      ⌁ 보조지표{showAI ? ` ${enabled.length}` : ""}
                    </button>
                    <button
                      aria-pressed={chartType === "candle"}
                      className={chartType === "candle" ? "active" : ""}
                      onClick={() => setChartType("candle")}
                      disabled={!current20}
                    >
                      캔들
                    </button>
                    <button
                      aria-pressed={chartType === "line"}
                      className={chartType === "line" ? "active" : ""}
                      onClick={() => setChartType("line")}
                    >
                      선
                    </button>
                    <button
                      aria-label="차트 전체 화면"
                      onClick={() => {
                        if (document.fullscreenElement)
                          void document
                            .exitFullscreen()
                            .catch(() =>
                              setError("전체 화면을 종료하지 못했습니다."),
                            );
                        else
                          void content.current
                            ?.requestFullscreen()
                            .catch(() =>
                              setError(
                                "이 브라우저에서는 전체 화면을 사용할 수 없습니다.",
                              ),
                            );
                      }}
                    >
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
                          setEnabled(draft);
                          setShowAI(true);
                          setPeriod(20);
                          setCompare(true);
                          setSelected(null);
                          setHovered(null);
                          close();
                        }}
                      >
                        차트에 AI 분석 추가
                      </button>
                    </div>
                  )}
                </div>
                <div className="ohlc">
                  <time>{displayDate ?? "데이터 조회 중"}</time>
                  <span className="snapshot-label">
                    {last ? "시세 저장본 · 실시간 아님" : "시세 데이터 미제공"}
                  </span>
                </div>
                {(compare || selected) && result && (
                  <>
                    <div className="comparison-hint">
                      Top {result.cases.length}에 마우스를 올리면 겹쳐 보기 ·
                      클릭하면 좌우 비교
                    </div>
                    <div className="case-strip">
                      {result.cases.map((c, i) => (
                        <button
                          key={c.date}
                          aria-label={`${i + 1}위 ${c.date} 과거 차트 비교`}
                          aria-pressed={selected?.date === c.date}
                          className={
                            selected?.date === c.date
                              ? "active"
                              : hovered?.date === c.date
                                ? "hovered"
                                : ""
                          }
                          onPointerEnter={() => hover(c)}
                          onPointerLeave={() => hover(null)}
                          onFocus={() => hover(c)}
                          onBlur={() => hover(null)}
                          onClick={() => select(c)}
                        >
                          <b>{String(i + 1).padStart(2, "0")}</b> {c.date}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {selected ? (
                  <>
                    <div className="split">
                      <section>
                        <h3 className="past">과거 · {selected.date}</h3>
                        <Chart
                          candles={pastCandles(selected)}
                          history={snapshot ? windowFor(snapshot.prices, selected.date, 21) : null}
                          path={selected.path}
                          type={chartType}
                          title="과거"
                        />
                      </section>
                      <section>
                        <h3 className="current">현재 · {displayDate}</h3>
                        <Chart
                          candles={current20}
                          history={snapshot && displayDate ? windowFor(snapshot.prices, displayDate, 21) : null}
                          path={result?.query.path}
                          type={chartType}
                          title="현재"
                        />
                      </section>
                    </div>
                    <div className="selected-outcome">
                      <b>선택한 과거 사례의 이후 20거래일</b>
                      <p>
                        수익률{" "}
                        <span className={tone(selected.fwd_return_20d)}>
                          {percent(selected.fwd_return_20d, true)}
                        </span>{" "}
                        · 최대낙폭 {percent(selected.fwd_max_drawdown_20d)}
                      </p>
                      <small>
                        차트는 기준일까지의 입력 구간입니다. 각 차트의
                        가격·거래량 축은 독립적입니다.
                      </small>
                      {selected.summary && <p>{selected.summary}</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <Chart
                      candles={usableCandles}
                      history={
                        snapshot && displayDate
                          ? windowFor(snapshot.prices, displayDate, 240)
                          : null
                      }
                      path={result?.query.path}
                      comparison={
                        hovered
                          ? {
                              candles: pastCandles(hovered),
                              path: hovered.path,
                              date: hovered.date,
                            }
                          : null
                      }
                      single
                      type={chartType}
                      title="현재"
                      averages={chartCount > 20 && !hovered}
                    />
                    <div className="range-controls">
                      <b>조회 기간</b>
                      {[20, 60, 120].map((n) => (
                        <button
                          key={n}
                          className={
                            (compare || hovered ? 20 : activePeriod) === n
                              ? "active"
                              : ""
                          }
                          disabled={!availablePeriods.includes(n)}
                          onClick={() => {
                            setPeriod(n);
                            setCompare(false);
                            setHovered(null);
                          }}
                        >
                          {n}거래일
                        </button>
                      ))}
                      <span className="zoom-controls">
                        <button
                          aria-label="차트 확대"
                          disabled={
                            activePeriod === 20 ||
                            Boolean(compare || hovered) ||
                            availablePeriods.length < 2
                          }
                          onClick={() =>
                            setPeriod(
                              availablePeriods[
                                availablePeriods.indexOf(activePeriod) - 1
                              ],
                            )
                          }
                        >
                          ＋
                        </button>
                        <button
                          aria-label="차트 축소"
                          disabled={
                            activePeriod === availablePeriods.at(-1) ||
                            Boolean(compare || hovered) ||
                            availablePeriods.length < 2
                          }
                          onClick={() =>
                            setPeriod(
                              availablePeriods[
                                availablePeriods.indexOf(activePeriod) + 1
                              ],
                            )
                          }
                        >
                          −
                        </button>
                      </span>
                    </div>
                  </>
                )}
                {snapshotError && <p className="notice">{snapshotError}</p>}
                {showAI && !selected && (
                  <section
                    className="analysis-section"
                    aria-label="AI 분석 결과"
                    aria-busy={busy}
                  >
                    <div className="analysis-heading">
                      <h2>
                        <span>HISTOCK AI</span> 보조지표
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setShowAI(false);
                          resetComparison();
                        }}
                      >
                        지표 숨기기 ×
                      </button>
                    </div>
                    <form
                      className="analysis-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void load(date, method);
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
                          onChange={(e) => setDate(e.target.value)}
                          disabled={busy || !health || health.status !== "ok"}
                        />
                      </label>
                      <label>
                        분석 방식{" "}
                        <select
                          aria-label="분석 방식"
                          value={method}
                          onChange={(e) => setMethod(e.target.value)}
                          disabled={busy || !methods}
                        >
                          {Object.keys(methods?.methods ?? { hybrid: "" }).map(
                            (key) => (
                              <option key={key} value={key}>
                                {(
                                  {
                                    hybrid: "하이브리드",
                                    e7_cnn: "CNN 패턴",
                                    summary: "통계 요약",
                                  } as Record<string, string>
                                )[key] ?? key}
                              </option>
                            ),
                          )}
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
                        {source === "snapshot"
                          ? "저장된 예시 분석"
                          : "백엔드 API 분석"}
                      </span>
                      {snapshot && source !== "snapshot" && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={useSnapshot}
                        >
                          저장된 예시 보기
                        </button>
                      )}
                      {source === "snapshot" && (
                        <button type="button" onClick={() => void load()}>
                          API 연결하기
                        </button>
                      )}
                    </form>
                    {health?.stale && source === "live" && (
                      <p className="notice">
                        데이터 갱신 지연 · {health.data_date} 기준 (
                        {health.business_days_behind}거래일 지연). 오늘 시세를
                        반영한 분석이 아닙니다.
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
                        <button
                          onClick={() => void load(date || undefined, method)}
                        >
                          다시 시도
                        </button>
                      </div>
                    )}
                    {result && !busy && (
                      <>
                        {result.query.requested !== result.query.date && (
                          <p className="notice">
                            요청일 {result.query.requested}은 휴장일이라 직전
                            거래일 {result.query.date} 기준으로 분석했어요.
                          </p>
                        )}
                        <div className="result-caption">
                          분석 결과 기준일 <b>{result.query.date}</b> ·{" "}
                          {result.method === "hybrid"
                            ? "하이브리드"
                            : result.method}
                        </div>
                        <AnalysisPanel
                          result={result}
                          enabled={enabled}
                          onCompare={() => {
                            setCompare(true);
                            setHovered(null);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          onHover={hover}
                          onSelect={select}
                        />
                      </>
                    )}
                  </section>
                )}
                <footer>
                  <span>
                    SPY · USD · 일별 데이터 · {displayDate ?? "—"} 기준
                  </span>
                  <span>
                    가격·거래량: {last ? "로컬 저장본" : "미제공"} / 분석:{" "}
                    {source === "live" ? "API" : "저장본"}
                  </span>
                </footer>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
