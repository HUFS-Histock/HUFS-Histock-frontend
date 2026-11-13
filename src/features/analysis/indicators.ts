export type Indicator = "volatility" | "crash" | "returns";
export const indicators: { key: Indicator; label: string }[] = [
  { key: "volatility", label: "변동성 추정" },
  { key: "crash", label: "급락 추정 확률" },
  { key: "returns", label: "수익률 범위" },
];
