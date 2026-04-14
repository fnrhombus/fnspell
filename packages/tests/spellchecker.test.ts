import { describe, it, expect, beforeEach } from "vitest";
import { SpellChecker, loadDictionary } from "fnspell";

// ~150 common English words for a practical test dictionary
const DICTIONARY_WORDS = [
  "a", "about", "after", "again", "all", "also", "am", "an", "and", "any",
  "apple", "are", "as", "at", "back", "bad", "be", "because", "been", "before",
  "being", "between", "big", "both", "boy", "bring", "but", "by", "call", "came",
  "can", "cat", "change", "children", "city", "close", "cold", "come", "could",
  "country", "day", "did", "different", "do", "does", "dog", "don't", "door",
  "down", "each", "end", "even", "every", "eye", "face", "family", "far", "father",
  "feel", "find", "first", "follow", "food", "for", "form", "found", "friend",
  "from", "get", "girl", "give", "go", "going", "good", "got", "great", "group",
  "had", "hand", "has", "have", "he", "head", "hear", "hello", "help", "her",
  "here", "high", "him", "his", "home", "hot", "house", "how", "idea", "if",
  "important", "in", "into", "is", "it", "its", "just", "keep", "kind", "know",
  "last", "leave", "left", "let", "life", "light", "like", "line", "little",
  "live", "long", "look", "love", "made", "make", "man", "many", "may", "me",
  "might", "mind", "more", "most", "mother", "much", "must", "my", "name",
  "need", "never", "new", "next", "night", "no", "not", "nothing", "now",
  "number", "of", "off", "old", "on", "one", "only", "open", "or", "other",
  "our", "out", "over", "own", "part", "people", "place", "point", "problem",
  "put", "question", "quite", "read", "really", "right", "run", "said", "same",
  "say", "school", "see", "she", "should", "show", "side", "small", "so", "some",
  "something", "state", "still", "story", "student", "study", "such", "take",
  "tell", "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "thing", "think", "this", "those", "thought", "three", "through",
  "time", "to", "too", "turn", "two", "under", "up", "us", "use", "very",
  "want", "water", "way", "we", "well", "went", "were", "what", "when", "where",
  "which", "while", "who", "why", "will", "with", "without", "word", "work",
  "world", "would", "write", "year", "you", "young",
];

let checker: SpellChecker;

beforeEach(() => {
  checker = new SpellChecker(DICTIONARY_WORDS);
});

describe("check()", () => {
  it("correctly identifies known words", () => {
    expect(checker.check("hello")).toBe(true);
    expect(checker.check("world")).toBe(true);
    expect(checker.check("the")).toBe(true);
    expect(checker.check("apple")).toBe(true);
  });

  it("rejects misspelled words", () => {
    expect(checker.check("helo")).toBe(false);
    expect(checker.check("wrold")).toBe(false);
    expect(checker.check("xyz")).toBe(false);
    expect(checker.check("flurble")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(checker.check("Hello")).toBe(true);
    expect(checker.check("WORLD")).toBe(true);
    expect(checker.check("ThE")).toBe(true);
    expect(checker.check("APPLE")).toBe(true);
  });
});

describe("suggest()", () => {
  it("returns correct word for common typos", () => {
    const suggestions = checker.suggest("helo");
    expect(suggestions).toContain("hello");
  });

  it("returns correct word for transposition typos", () => {
    const suggestions = checker.suggest("wrold");
    expect(suggestions).toContain("world");
  });

  it("returns multiple suggestions sorted by distance", () => {
    // "helo" is distance 1 from "hello" and "help" and "hero" isn't in dict
    const suggestions = checker.suggest("helo");
    expect(suggestions.length).toBeGreaterThan(1);

    // Verify sorted: each suggestion should have distance <= next
    for (let i = 0; i < suggestions.length - 1; i++) {
      const distA = levenshteinDist("helo", suggestions[i]);
      const distB = levenshteinDist("helo", suggestions[i + 1]);
      expect(distA).toBeLessThanOrEqual(distB);
    }
  });

  it("respects limit parameter", () => {
    const suggestions = checker.suggest("helo", 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it("returns empty array for correctly spelled word", () => {
    expect(checker.suggest("hello")).toEqual([]);
  });

  it("returns suggestions for single character deletion", () => {
    const suggestions = checker.suggest("schol");
    expect(suggestions).toContain("school");
  });

  it("returns suggestions for single character insertion", () => {
    const suggestions = checker.suggest("schoool");
    expect(suggestions).toContain("school");
  });
});

describe("add()", () => {
  it("new words are recognized after adding", () => {
    expect(checker.check("typescript")).toBe(false);
    checker.add("typescript");
    expect(checker.check("typescript")).toBe(true);
  });

  it("added words appear in suggestions", () => {
    checker.add("typescript");
    const suggestions = checker.suggest("typescrip");
    expect(suggestions).toContain("typescript");
  });

  it("size increases when adding a new word", () => {
    const before = checker.size;
    checker.add("xylophone");
    expect(checker.size).toBe(before + 1);
  });

  it("adding an existing word does not change size", () => {
    const before = checker.size;
    checker.add("hello");
    expect(checker.size).toBe(before);
  });
});

describe("remove()", () => {
  it("removed words are no longer recognized", () => {
    expect(checker.check("hello")).toBe(true);
    checker.remove("hello");
    expect(checker.check("hello")).toBe(false);
  });

  it("removed words no longer appear in suggestions", () => {
    checker.remove("hello");
    const suggestions = checker.suggest("helo");
    expect(suggestions).not.toContain("hello");
  });

  it("size decreases when removing a word", () => {
    const before = checker.size;
    checker.remove("hello");
    expect(checker.size).toBe(before - 1);
  });

  it("removing a non-existent word does nothing", () => {
    const before = checker.size;
    checker.remove("nonexistent");
    expect(checker.size).toBe(before);
  });
});

describe("checkText()", () => {
  it("finds misspelled words with correct positions", () => {
    const results = checker.checkText("the helo world");
    expect(results).toHaveLength(1);
    expect(results[0].word).toBe("helo");
    expect(results[0].offset).toBe(4);
    expect(results[0].length).toBe(4);
  });

  it("returns suggestions for each misspelled word", () => {
    const results = checker.checkText("helo wrold");
    expect(results).toHaveLength(2);
    expect(results[0].suggestions).toContain("hello");
    expect(results[1].suggestions).toContain("world");
  });

  it("handles punctuation correctly", () => {
    const results = checker.checkText("hello, world! the good day.");
    expect(results).toHaveLength(0);
  });

  it("handles apostrophes (contractions)", () => {
    const results = checker.checkText("I don't know");
    // "don't" is in the dictionary, "I" maps to lowercase "i" which isn't
    // but single letters might not match — let's just check don't works
    const dontResult = results.find((r) => r.word === "don't");
    expect(dontResult).toBeUndefined(); // don't should be recognized
  });

  it("handles text with numbers", () => {
    const results = checker.checkText("hello 123 world");
    expect(results).toHaveLength(0);
  });

  it("returns empty array for text with no misspellings", () => {
    const results = checker.checkText("the good day");
    expect(results).toHaveLength(0);
  });

  it("returns empty array for empty text", () => {
    const results = checker.checkText("");
    expect(results).toHaveLength(0);
  });
});

describe("loadDictionary()", () => {
  it("parses newline-separated word list", () => {
    const checker = loadDictionary("hello\nworld\ngoodbye");
    expect(checker.check("hello")).toBe(true);
    expect(checker.check("world")).toBe(true);
    expect(checker.check("goodbye")).toBe(true);
    expect(checker.size).toBe(3);
  });

  it("handles Windows-style line endings", () => {
    const checker = loadDictionary("hello\r\nworld\r\ngoodbye");
    expect(checker.check("hello")).toBe(true);
    expect(checker.check("world")).toBe(true);
    expect(checker.size).toBe(3);
  });

  it("skips blank lines", () => {
    const checker = loadDictionary("hello\n\nworld\n\n");
    expect(checker.size).toBe(2);
  });

  it("trims whitespace from words", () => {
    const checker = loadDictionary("  hello  \n  world  ");
    expect(checker.check("hello")).toBe(true);
    expect(checker.check("world")).toBe(true);
  });
});

describe("edge cases", () => {
  it("empty dictionary", () => {
    const empty = new SpellChecker([]);
    expect(empty.size).toBe(0);
    expect(empty.check("hello")).toBe(false);
    expect(empty.suggest("hello")).toEqual([]);
    expect(empty.checkText("hello world")).toHaveLength(2);
  });

  it("single-word dictionary", () => {
    const single = new SpellChecker(["hello"]);
    expect(single.size).toBe(1);
    expect(single.check("hello")).toBe(true);
    expect(single.check("world")).toBe(false);
    expect(single.suggest("helo")).toContain("hello");
  });

  it("very long word", () => {
    const longWord = "supercalifragilisticexpialidocious";
    const checker = new SpellChecker([longWord]);
    expect(checker.check(longWord)).toBe(true);
    expect(checker.check("supercalifragilistic")).toBe(false);
  });

  it("word not reachable via deletion map", () => {
    // "xyz" has no overlap with "hello" within edit distance 2
    const checker = new SpellChecker(["hello"]);
    const suggestions = checker.suggest("xyz");
    expect(suggestions).toEqual([]);
  });

  it("constructor accepts a Set", () => {
    const set = new Set(["hello", "world"]);
    const checker = new SpellChecker(set);
    expect(checker.check("hello")).toBe(true);
    expect(checker.check("world")).toBe(true);
    expect(checker.size).toBe(2);
  });

  it("size property is readonly and accurate", () => {
    expect(checker.size).toBe(DICTIONARY_WORDS.length);
  });
});

// Helper for test assertions
function levenshteinDist(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[n];
}
