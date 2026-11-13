import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a href="/" className="brand">
        <Logo size={40} />
        <span>HISTOCK</span>
      </a>
      <div className="instrument-search">
        ⌕ <span>SPY · SPDR S&P 500</span>
      </div>
      <small>SPY · 20거래일 분석</small>
    </header>
  );
}
