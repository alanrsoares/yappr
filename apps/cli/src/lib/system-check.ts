import { spawnSync } from "node:child_process";

export type SystemBinary = "uv" | "ffmpeg" | "espeak-ng";

export interface SystemBinaryStatus {
  name: SystemBinary;
  found: boolean;
  /** Resolved absolute path, when found. */
  path: string | null;
  /** Suggested install command for the current platform. */
  installHint: string;
}

const INSTALL_HINTS: Record<SystemBinary, string> = {
  uv: "curl -LsSf https://astral.sh/uv/install.sh | sh",
  ffmpeg: "brew install ffmpeg",
  "espeak-ng": "brew install espeak-ng",
};

function which(bin: string): string | null {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const out = r.stdout.trim();
  return out || null;
}

export function checkSystemBinary(name: SystemBinary): SystemBinaryStatus {
  const path = which(name);
  return {
    name,
    found: path !== null,
    path,
    installHint: INSTALL_HINTS[name],
  };
}

export function checkSystemBinaries(): SystemBinaryStatus[] {
  return (["uv", "ffmpeg", "espeak-ng"] as const).map(checkSystemBinary);
}
