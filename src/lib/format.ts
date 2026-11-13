/** 가격·비율 공통 포맷터 (차트·분석·종목 사이드바 공용). */
export const percent = (v: number | null, signed = false): string =>
  v === null
    ? "—"
    : `${v < 0 ? "−" : signed && v > 0 ? "+" : ""}${Math.abs(v * 100).toFixed(1)}%`;
export const tone = (v: number | null): string =>
  v == null || v === 0 ? "" : v > 0 ? "up" : "down";
export const price = (v: number): string =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
