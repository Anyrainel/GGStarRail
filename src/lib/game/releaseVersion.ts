function versionParts(version: string | null | undefined): number[] | null {
  if (!version || !/^\d+(?:\.\d+)*$/.test(version.trim())) return null;
  return version.trim().split(".").map(Number);
}

/** Newest source patch first, with unknown releases after dated entries. */
export function compareReleaseVersionsDescending(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (!leftParts) return rightParts ? 1 : 0;
  if (!rightParts) return -1;
  for (
    let index = 0;
    index < Math.max(leftParts.length, rightParts.length);
    index += 1
  ) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
