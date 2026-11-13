import type { Analysis } from "../../lib/api";
import { percent, tone } from "../../lib/format";

/** 분석 기준일 이후의 실제 관측 결과 (관측 기간이 남았으면 안내 문구). */
export function ActualOutcome({ actual }: { actual: Analysis["actual"] }) {
  return (
    <div className="actual">
      {actual ? (
        <>
          분석 기준일 이후 실제 관측: 수익률{" "}
          <b className={tone(actual.fwd_return_20d)}>
            {percent(actual.fwd_return_20d, true)}
          </b>{" "}
          · 변동성 {percent(actual.fwd_vol_20d)} · 최대낙폭{" "}
          {percent(actual.fwd_max_drawdown_20d)} · 급락{" "}
          {actual.crash === null
            ? "미관측"
            : actual.crash
              ? "발생"
              : "미발생"}
        </>
      ) : (
        "분석 기준일 이후 실제 결과: 아직 관측 기간이 완료되지 않았어요."
      )}
    </div>
  );
}
