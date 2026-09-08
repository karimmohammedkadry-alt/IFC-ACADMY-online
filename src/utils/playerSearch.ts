import { Player } from '../types';

/** Normalize Arabic/Latin digits and text for consistent player searching. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ar-EG');
}

/** Search players by the unified fields requested by the academy. */
export function playerMatchesSearch(player: Player, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return [
    player.name,
    player.memberNumber,
    player.phone,
    player.parentPhone,
    player.nationalId,
  ].some((value) => normalizeSearchText(value).includes(q));
}
