export interface MisspelledWord {
  word: string;
  /** Character offset in original text */
  offset: number;
  length: number;
  /** Top 5 suggestions */
  suggestions: string[];
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows instead of full matrix
  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Generate all deletions of a word within a given edit distance.
 * Returns a set of strings produced by deleting 1..maxDist characters.
 */
function deletions(word: string, maxDist: number): Set<string> {
  const result = new Set<string>();
  const queue: Array<[string, number]> = [[word, 0]];

  while (queue.length > 0) {
    const [current, depth] = queue.pop()!;
    if (depth >= maxDist) continue;

    for (let i = 0; i < current.length; i++) {
      const deleted = current.slice(0, i) + current.slice(i + 1);
      if (!result.has(deleted)) {
        result.add(deleted);
        queue.push([deleted, depth + 1]);
      }
    }
  }

  return result;
}

const MAX_EDIT_DISTANCE = 2;

export class SpellChecker {
  private readonly words: Set<string>;
  private readonly deleteMap: Map<string, string[]>;

  constructor(words: string[] | Set<string>) {
    this.words = new Set<string>();
    this.deleteMap = new Map();

    const source = words instanceof Set ? words : words;
    for (const w of source) {
      const lower = w.toLowerCase();
      this.words.add(lower);
    }

    this.buildDeleteMap();
  }

  private buildDeleteMap(): void {
    for (const word of this.words) {
      for (const del of deletions(word, MAX_EDIT_DISTANCE)) {
        const existing = this.deleteMap.get(del);
        if (existing) {
          existing.push(word);
        } else {
          this.deleteMap.set(del, [word]);
        }
      }
    }
  }

  /**
   * Rebuild the deletion map entry for a single word (add its deletions).
   */
  private addToDeleteMap(word: string): void {
    for (const del of deletions(word, MAX_EDIT_DISTANCE)) {
      const existing = this.deleteMap.get(del);
      if (existing) {
        existing.push(word);
      } else {
        this.deleteMap.set(del, [word]);
      }
    }
  }

  /**
   * Remove a word's deletions from the map.
   */
  private removeFromDeleteMap(word: string): void {
    for (const del of deletions(word, MAX_EDIT_DISTANCE)) {
      const existing = this.deleteMap.get(del);
      if (existing) {
        const idx = existing.indexOf(word);
        if (idx !== -1) {
          existing.splice(idx, 1);
          if (existing.length === 0) {
            this.deleteMap.delete(del);
          }
        }
      }
    }
  }

  /** Check if a word is spelled correctly (case-insensitive). */
  check(word: string): boolean {
    return this.words.has(word.toLowerCase());
  }

  /**
   * Get spelling suggestions sorted by edit distance (ascending),
   * then alphabetically. Returns up to `limit` results.
   */
  suggest(word: string, limit = 5): string[] {
    const lower = word.toLowerCase();

    // Exact match — no suggestions needed
    if (this.words.has(lower)) return [];

    const candidates = new Map<string, number>();

    // Check if the misspelled word itself is a deletion of a dictionary word
    // (i.e., dictionary word is longer — we'd find it via its deletions matching our word)
    const directHits = this.deleteMap.get(lower);
    if (directHits) {
      for (const hit of directHits) {
        if (!candidates.has(hit)) {
          candidates.set(hit, levenshtein(lower, hit));
        }
      }
    }

    // Generate deletions of the misspelled word and look them up
    const dels = deletions(lower, MAX_EDIT_DISTANCE);
    for (const del of dels) {
      const hits = this.deleteMap.get(del);
      if (hits) {
        for (const hit of hits) {
          if (!candidates.has(hit)) {
            const dist = levenshtein(lower, hit);
            if (dist <= MAX_EDIT_DISTANCE) {
              candidates.set(hit, dist);
            }
          }
        }
      }

      // Also check if the deletion itself is a valid word
      if (this.words.has(del) && !candidates.has(del)) {
        const dist = levenshtein(lower, del);
        if (dist <= MAX_EDIT_DISTANCE) {
          candidates.set(del, dist);
        }
      }
    }

    return [...candidates.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([w]) => w);
  }

  /** Add a word to the dictionary. */
  add(word: string): void {
    const lower = word.toLowerCase();
    if (this.words.has(lower)) return;
    this.words.add(lower);
    this.addToDeleteMap(lower);
  }

  /** Remove a word from the dictionary. */
  remove(word: string): void {
    const lower = word.toLowerCase();
    if (!this.words.has(lower)) return;
    this.words.delete(lower);
    this.removeFromDeleteMap(lower);
  }

  /**
   * Check text for misspelled words. Returns each misspelled word
   * with its position and top 5 suggestions.
   */
  checkText(text: string): MisspelledWord[] {
    const results: MisspelledWord[] = [];
    const regex = /\b[a-zA-Z']+\b/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      // Skip words that are just apostrophes
      if (word.replace(/'/g, "").length === 0) continue;

      if (!this.check(word)) {
        results.push({
          word,
          offset: match.index,
          length: word.length,
          suggestions: this.suggest(word),
        });
      }
    }

    return results;
  }

  /** Number of words in the dictionary. */
  get size(): number {
    return this.words.size;
  }
}

/**
 * Load a dictionary from a newline-separated word list.
 */
export function loadDictionary(text: string): SpellChecker {
  const words = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return new SpellChecker(words);
}
