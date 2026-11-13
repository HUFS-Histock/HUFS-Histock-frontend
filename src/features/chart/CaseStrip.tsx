import type { RefObject } from "react";
import type { Case } from "../../lib/api";

type Props = {
  cases: Case[];
  selected: Case | null;
  hovered: Case | null;
  onHover: (c: Case | null) => void;
  onSelect: (c: Case) => void;
  stripRef: RefObject<HTMLDivElement | null>;
};

export function CaseStrip({
  cases,
  selected,
  hovered,
  onHover,
  onSelect,
  stripRef,
}: Props) {
  return (
    <>
      <div className="comparison-hint">
        Top {cases.length}에 마우스를 올리면 겹쳐 보기 · 클릭하면 좌우 비교
      </div>
      <div ref={stripRef} className="case-strip">
        {cases.map((c, i) => (
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
            onPointerEnter={() => onHover(c)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(c)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(c)}
          >
            <b>{String(i + 1).padStart(2, "0")}</b> {c.date}
          </button>
        ))}
      </div>
    </>
  );
}
