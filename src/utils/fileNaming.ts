/**
 * Generates a filename-safe slug for a scene.
 * e.g. "한강 마포대교" → "hangangmapo" (romanized would require a library,
 * so we strip non-ASCII and use the scene id as primary)
 */
export function sceneFilename(id: string, location?: string): string {
  if (!location) return `${id}.json`;
  // Remove special chars, keep alphanumeric and Korean
  const slug = location
    .replace(/[^\w가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 30);
  return `${id}-${slug}.json`;
}

export function characterFilename(id: string): string {
  return `${id}.json`;
}

export function eventFilename(id: string): string {
  return `${id}.json`;
}

export function threadFilename(id: string): string {
  return `${id}.json`;
}
