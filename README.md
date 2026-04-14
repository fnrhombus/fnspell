# fnspell

**Spell check in the browser. No WASM. No server. Just words.**

[![npm version](https://img.shields.io/npm/v/fnspell)](https://www.npmjs.com/package/fnspell)
[![bundle size](https://img.shields.io/bundlephobia/minzip/fnspell)](https://bundlephobia.com/package/fnspell)
[![license](https://img.shields.io/npm/l/fnspell)](./LICENSE)

```typescript
import { SpellChecker } from "fnspell";

const checker = new SpellChecker(["hello", "world", "goodbye", "friend"]);

checker.check("hello");   // true
checker.check("helo");    // false

checker.suggest("helo");  // ["hello"]
checker.suggest("wrold"); // ["world"]

checker.checkText("helo wrold");
// [
//   { word: "helo",  offset: 0, length: 4, suggestions: ["hello"] },
//   { word: "wrold", offset: 5, length: 5, suggestions: ["world"] }
// ]
```

## The problem

[hunspell-asm](https://github.com/nicolo-ribaudo/nicolo-nicolo-nicolo.nicolo) is stale and pulls in WASM. [nspell](https://github.com/wooorm/nspell) is full-featured but slow for real-time use. [spellchecker-wasm](https://github.com/nickvdbergh/nickvdbergh-spellchecker) needs a WASM runtime.

Sometimes you just want a dictionary and suggestions that work everywhere -- browser, Node, edge functions -- with zero dependencies and zero native code.

## How it works

fnspell uses a **SymSpell-inspired deletion-based** suggestion algorithm:

1. On construction, every dictionary word has its edit-distance-2 deletions pre-computed and stored in a `Map<deletion, originalWords[]>`.
2. When you call `suggest("helo")`, fnspell generates deletions of the misspelled word and looks them up in the pre-computed map.
3. Candidates found this way are verified with exact Levenshtein distance, then sorted by distance (ascending) and alphabetically.

This is orders of magnitude faster than brute-force Levenshtein against every word in the dictionary. Dictionary lookup is O(1) via `Set`.

## BYO dictionary

fnspell accepts any word list -- pass an array, a `Set`, or use `loadDictionary()` with a newline-separated string:

```typescript
import { loadDictionary } from "fnspell";

const text = await fetch("/words.txt").then((r) => r.text());
const checker = loadDictionary(text);
```

Where to find word lists:

- [SCOWL](http://wordlist.aspell.net/) -- the basis for most English spell checkers
- [aspell dictionaries](ftp://ftp.gnu.org/gnu/aspell/dict/) -- many languages
- [dwyl/english-words](https://github.com/dwyl/english-words) -- 466k English words

## API

### `new SpellChecker(words: string[] | Set<string>)`

Create a spell checker with the given dictionary. Words are stored lowercased.

### `checker.check(word: string): boolean`

Check if a word is spelled correctly. Case-insensitive.

### `checker.suggest(word: string, limit?: number): string[]`

Get spelling suggestions sorted by similarity. Default limit is 5. Returns `[]` for correctly spelled words.

### `checker.add(word: string): void`

Add a word to the dictionary.

### `checker.remove(word: string): void`

Remove a word from the dictionary.

### `checker.checkText(text: string): MisspelledWord[]`

Check text for misspellings. Returns each misspelled word with its position and top 5 suggestions.

```typescript
interface MisspelledWord {
  word: string;
  offset: number;     // character offset in original text
  length: number;
  suggestions: string[];
}
```

### `loadDictionary(text: string): SpellChecker`

Create a `SpellChecker` from a newline-separated word list string.

### `checker.size: number`

Number of words in the dictionary.

## Comparison

| Feature | fnspell | nspell | hunspell-asm | spellchecker-wasm |
|---|---|---|---|---|
| Zero dependencies | Yes | No | No | No |
| Browser support | Yes | Yes | Yes | Needs WASM |
| Native code / WASM | No | No | WASM | WASM |
| Suggestions | Yes | Yes | Yes | Yes |
| Affix rules | No | Yes | Yes | No |
| Actively maintained | Yes | Yes | No | No |
| Bundle size | Tiny | Medium | Large | Large |

## Support

If fnspell is useful to you, consider supporting development:

- [GitHub Sponsors](https://github.com/sponsors/fnrhombus)
- [Buy Me a Coffee](https://buymeacoffee.com/fnrhombus)

## License

[MIT](./LICENSE)
