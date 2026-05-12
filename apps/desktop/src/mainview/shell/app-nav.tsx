import { Link } from "@tanstack/react-router";

import { cn } from "~/lib/utils";

const navLinkClass = (isActive: boolean) =>
  cn(
    "font-label font-medium uppercase rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-led-amber focus-visible:ring-offset-2 focus-visible:ring-offset-chassis-deep",
    "text-[0.58rem] tracking-[0.28em] px-2 py-1.5 @md/shell:text-[0.65rem] @md/shell:tracking-[0.35em] @md/shell:px-3 @md/shell:py-2",
    isActive
      ? "border-led-amber/45 text-led-amber shadow-[0_0_10px_rgba(255,165,0,0.2)] bg-chassis-deep/80"
      : "border-transparent text-foil-mute hover:border-foil-dim/50 hover:text-foil",
  );

export function AppNav() {
  return (
    <nav
      className="flex flex-wrap items-center justify-end gap-1.5 @md/shell:gap-2"
      aria-label="Primary"
    >
      <Link
        to="/"
        activeOptions={{ exact: true }}
        className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-led-amber focus-visible:ring-offset-2 focus-visible:ring-offset-chassis-deep"
      >
        {({ isActive }) => (
          <span className={navLinkClass(isActive)}>Voice</span>
        )}
      </Link>
      <Link
        to="/chat"
        className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-led-amber focus-visible:ring-offset-2 focus-visible:ring-offset-chassis-deep"
      >
        {({ isActive }) => <span className={navLinkClass(isActive)}>Chat</span>}
      </Link>
    </nav>
  );
}
