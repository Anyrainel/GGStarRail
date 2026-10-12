import { betaEnabled, setBetaEnabled } from "@/providers/reference/betaState";

export function maybeHandleBetaMagic(value: string): boolean {
  if (value !== "开启测试模式" && value !== "关闭测试模式") return false;
  const enabled = value === "开启测试模式";
  if (enabled !== betaEnabled()) {
    setBetaEnabled(enabled);
    // All catalog consumers and derived caches restart under the new gate.
    window.location.reload();
  }
  return true;
}
