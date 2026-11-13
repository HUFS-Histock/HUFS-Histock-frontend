type Props = {
  available: number[];
  activeValue: number;
  onPick: (period: number) => void;
};

export function RangeControls({ available, activeValue, onPick }: Props) {
  return (
    <div className="range-controls">
      <b>조회 기간</b>
      {[20, 60, 120].map((n) => (
        <button
          key={n}
          className={activeValue === n ? "active" : ""}
          disabled={!available.includes(n)}
          onClick={() => onPick(n)}
        >
          {n}거래일
        </button>
      ))}
    </div>
  );
}
