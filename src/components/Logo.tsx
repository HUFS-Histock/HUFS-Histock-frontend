import { useId } from "react";

/**
 * HISTOCK 로고 마크.
 * 왼쪽 기둥은 심지가 달린 과거 캔들(보라), 오른쪽 기둥은 현재(그린),
 * 가로 횡단선은 과거(점선) → 매치 노드 → 현재(실선)로 이어지는 유사 구간 매치.
 * public/logo-mark.svg 와 같은 도형이다.
 */
export function Logo({
  size = 38,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tile = `hs-tile-${uid}`;
  const past = `hs-past-${uid}`;
  const now = `hs-now-${uid}`;
  const glow = `hs-glow-${uid}`;
  const sheen = `hs-sheen-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#243043" />
          <stop offset="1" stopColor="#0a0e15" />
        </linearGradient>
        <linearGradient id={past} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a88ef7" />
          <stop offset="1" stopColor="#6638d2" />
        </linearGradient>
        <linearGradient id={now} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#45e790" />
          <stop offset="1" stopColor="#009b4f" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2ee383" stopOpacity="0.3" />
          <stop offset="1" stopColor="#2ee383" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={sheen} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${tile})`} />
      <circle cx="170" cy="140" r="300" fill={`url(#${sheen})`} />
      <rect
        x="1.5"
        y="1.5"
        width="509"
        height="509"
        rx="114.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.07"
        strokeWidth="3"
      />
      <circle cx="256" cy="256" r="38" fill={`url(#${glow})`} />
      <line
        x1="194"
        y1="256"
        x2="222"
        y2="256"
        stroke="#9d88f0"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <line
        x1="290"
        y1="256"
        x2="318"
        y2="256"
        stroke="#e9eef7"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <line
        x1="176"
        y1="120"
        x2="176"
        y2="386"
        stroke="#7b57e0"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <rect x="150" y="144" width="52" height="224" rx="26" fill={`url(#${past})`} />
      <rect x="310" y="144" width="52" height="224" rx="26" fill={`url(#${now})`} />
      <circle cx="256" cy="256" r="21" fill="#ffffff" />
      <circle cx="256" cy="256" r="13" fill="#2ee383" />
    </svg>
  );
}
