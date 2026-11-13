import { useEffect, useRef, useState } from "react";
import {
  parseHealth,
  parseMethods,
  parseSnapshot,
  request,
  search,
} from "../../lib/api";
import type { Analysis, Health, Methods, Snapshot } from "../../lib/api";
import type { Indicator } from "./indicators";

/** 분석 데이터 파이프라인: 로컬 시세 스냅숏과 백엔드 분석 API를 가져온다. */
export function useAnalysis() {
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
  const [enabled, setEnabled] = useState<Indicator[]>([
    "volatility",
    "crash",
    "returns",
  ]);
  const activeRequest = useRef<AbortController | null>(null);

  async function load(dateValue?: string, methodValue?: string) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError("");
    setSource("live");
    setResult(null);
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

  /** 네트워크 호출 없이 저장된 예시 분석으로 전환한다. */
  function applySnapshot() {
    if (!snapshot) return;
    activeRequest.current?.abort();
    setBusy(false);
    setError("");
    setSource("snapshot");
    setResult(snapshot.analysis);
    setDate(snapshot.analysis.query.date);
    setMethod(snapshot.analysis.method);
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

  return {
    snapshot,
    snapshotError,
    health,
    methods,
    result,
    date,
    method,
    source,
    error,
    busy,
    enabled,
    setError,
    setDate,
    setMethod,
    setEnabled,
    load,
    applySnapshot,
  };
}
