import { Box } from "ink";
import type { ReactNode } from "react";

import { Footer, type FooterItem } from "./footer.js";
import { Header } from "./header.js";

export interface ScreenShellProps {
  title: string;
  subtitle?: string;
  badge?: string;
  footerItems: FooterItem[];
  children: ReactNode;
}

/**
 * Full-height screen frame: pinned Header at top, flexGrow body, pinned Footer at bottom.
 */
export function ScreenShell({
  title,
  subtitle,
  badge,
  footerItems,
  children,
}: ScreenShellProps) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
      <Header title={title} subtitle={subtitle} badge={badge} />
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
      <Footer items={footerItems} marginTop={1} />
    </Box>
  );
}
