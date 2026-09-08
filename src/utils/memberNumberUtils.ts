import { Player } from '../types';

/**
 * Generates the next sequential membership number (e.g. 'IFC-001', 'IFC-002')
 * Guarantees uniqueness by checking all existing player records.
 */
export function generateNextMemberNumber(
  existingPlayers: Player[],
  prefix: string = 'IFC'
): string {
  const cleanPrefix = prefix.trim().toUpperCase();
  const existingNumbersSet = new Set<string>();

  let maxSequentialId = 0;

  for (const player of existingPlayers) {
    if (!player.memberNumber) continue;
    const strVal = String(player.memberNumber).trim();
    existingNumbersSet.add(strVal.toUpperCase());

    // Check if it matches pattern PREFIX-NUMBER or just a number
    const prefixRegex = new RegExp(`^${cleanPrefix}[-_]?(\\d+)$`, 'i');
    const match = strVal.match(prefixRegex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSequentialId) {
        maxSequentialId = num;
      }
    } else {
      // If purely numeric e.g. 1001 or 1, check if we should track
      const pureNum = parseInt(strVal, 10);
      if (!isNaN(pureNum) && pureNum < 9000 && pureNum > maxSequentialId) {
        // Only consider if not a random 4-digit generated fallback
        maxSequentialId = Math.max(maxSequentialId, pureNum);
      }
    }
  }

  // Next candidate number
  let candidateNum = maxSequentialId + 1;
  let formatted = `${cleanPrefix}-${String(candidateNum).padStart(3, '0')}`;

  // Ensure 100% uniqueness
  while (existingNumbersSet.has(formatted.toUpperCase())) {
    candidateNum++;
    formatted = `${cleanPrefix}-${String(candidateNum).padStart(3, '0')}`;
  }

  return formatted;
}

/**
 * Validates if a given member number is unique across all players.
 */
export function isMemberNumberUnique(
  memberNumber: string | number,
  existingPlayers: Player[],
  excludePlayerId?: string
): boolean {
  if (!memberNumber) return false;
  const target = String(memberNumber).trim().toUpperCase();

  return !existingPlayers.some(
    (p) => p.id !== excludePlayerId && String(p.memberNumber).trim().toUpperCase() === target
  );
}
