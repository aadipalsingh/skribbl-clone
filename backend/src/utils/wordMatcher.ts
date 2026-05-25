/**
 * Computes the Levenshtein distance between two strings.
 * This represents the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one string into another.
 */
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,        // deletion
        matrix[i][j - 1] + 1,        // insertion
        matrix[i - 1][j - 1] + cost  // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Validates a player's typed guess against the active secret word.
 * Returns:
 * - 'correct' if matches exactly (normalized)
 * - 'close' if it is exactly one character modification off (highly helpful for UX)
 * - 'chat' if it is completely different
 */
export function validateGuess(guess: string, secretWord: string): 'correct' | 'close' | 'chat' {
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedSecret = secretWord.trim().toLowerCase();

  if (normalizedGuess === normalizedSecret) {
    return 'correct';
  }

  // Check if it's close (only 1 typo/edit difference)
  // We only check close suggestions for words of length >= 3 to prevent false positive triggers
  if (normalizedSecret.length >= 3) {
    const distance = getLevenshteinDistance(normalizedGuess, normalizedSecret);
    if (distance === 1) {
      return 'close';
    }
  }

  return 'chat';
}
