# tree-sitter-deka

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
[DekaScript](https://github.com/dekaruntime/deka) (`.ds`) and DSX (`.dsx`),
the language compiled by [`dsc`](https://github.com/dekaruntime/dsc).

One grammar covers both extensions: `.ds` modules and `.dsx` components.
DekaScript has no `<T>expr` type-assertion syntax, so — unlike
tree-sitter-typescript, which splits `ts`/`tsx` over exactly that ambiguity —
there is nothing to disambiguate, and JSX parses unconditionally for both
extensions (matching `dsc`, whose single parser accepts JSX in every file).

## Fork lineage

This grammar is a **fork of [tree-sitter-typescript](https://github.com/tree-sitter/tree-sitter-typescript)
(the `tsx` variant) at commit `75b3874edb2dc714fb1fd77a32013f0d8699989f`,
which itself layers TypeScript rules on top of
[tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript)
`0.23.1`. `grammar.js` keeps upstream's architecture
(`grammar(JavaScript, { ... })` with dialect-wide overrides); the inherited
overrides are marked `inherited verbatim from tree-sitter-typescript`, and the
DekaScript additions are marked `DEKA-SPECIFIC`. The external scanner
(`scanner/scanner.h`) is upstream's `common/scanner.h` plus one added token
(see below).

### Removed relative to tsx

- **Type assertions** (`<T>expr`) — the reason tsx exists as a separate
  dialect. DekaScript has no such syntax (settled in dekaruntime/deka#1049).
- **TypeScript-only type forms**: object/mapped/conditional/tuple/lookup/
  `typeof` types, intersections (`&`), literal types, `infer`/`extends`
  constraints, and the `keyof` operator. None are producible by dsc's type
  parser (`crates/deka_syntax/src/parse/ty.rs`), which accepts only named
  types, generics, `fn(T, U) R` function types, parenthesized types, unions
  (`A | B`), and the postfix option type (`T?`). Dropping them also removes
  the `{`-ambiguity between `fn` bodies and object types.
- **DekaScript-absent operators** from the binary/unary layers: bitwise
  (`&`, `|`, `^`, shifts), `instanceof`, `in`, `typeof`, `void`, `delete`.
  `void` in particular is an ordinary type *name* in DekaScript
  (`fn() void`), not a keyword.
- **Namespace/module/ambient machinery** (`namespace`, `module`,
  `declare`, `import x = ...`) — no DekaScript equivalent.

Everything else (classes, `function` declarations, arrows, destructuring,
regexes, optional chaining, ...) is kept as a deliberately lenient superset:
dsc rejects it, but a highlighter that errors on it would be worse. Classes
etc. remain reserved words, exactly as they are in the forked grammar.

### Added for DekaScript

- `fn` declarations: `fn name<T: Bound>(params) ReturnType { ... }` — the
  return type has **no colon** and is omitted entirely when the body follows
  immediately (`dsc` rejects `fn f(): T`).
- Receiver methods: `fn (s Signal<T>) get() T { ... }`.
- `struct` declarations: newline/`;`-separated fields (`name?: Type = default`),
  embedded structs (`struct Outer { Inner }`), `super struct`.
- `enum` declarations with payloads (`Case(Type)`), `super enum`.
- `interface` declarations with DekaScript members: `mut` fields and paren-less
  method signatures (`fn get(key: string) string`) without separators, as in
  the deka stdlib packages.
- `alias X = T` and deprecated `type X = T`, plus the newtype form
  `type Name Repr`.
- `match` expressions with constructor (`Ok(v)`, `Color.Red(p)`), struct
  (`Point { x }`), tuple, literal, wildcard, and `|` or-patterns.
- `unsafe<T> { ... }` raw-JavaScript blocks — scanned as one opaque `raw_js`
  token by the external scanner and injected as JavaScript (see
  `queries/injections.scm`). This is the one scanner addition.
- `build { ... }` build-phase blocks and `bridge kind.action(args)` host calls.
- Struct literals: `Post { slug: "...", tags: [...] }`.
- `unwrap(x) or { ... }` / `unwrap(x) or match { ... }` bindings (deka#445).
- `None` literal; `|>` pipe operator (same precedence as `&&`).

## Known gaps

Documented, accepted divergences from dsc (pull requests welcome):

- **Juxtaposition calls** (`fn arg` sugar for `fn(arg)`) are not parsed; they
  produce ERROR nodes. The sugar needs newline-sensitive lexing tree-sitter
  cannot express cleanly.
- `f\n(x)` on separate lines parses as a call (JavaScript's automatic
  semicolon insertion rules), where DekaScript treats the newline as a
  statement terminator.
- Array/tuple type syntax (`T[]`, `[A, B]`) is not supported — it is not
  valid DekaScript; use `Array<T>`.
- `let unwrap = ...` cannot declare a variable named `unwrap` (the unwrap
  binding makes it a contextual keyword, like `await` in the JavaScript
  grammar). Using `unwrap` as a call or expression works fine.
- The `raw_js` scanner tracks braces, strings, and comments, but not `${}`
  substitutions inside template literals nested in `unsafe` blocks; a `}`
  inside such a substitution closes the block early.
- Legacy syntax predating current dsc (`opaque type`, `safe { ... }`) does not
  parse; neither do the host's intentionally-rejected fixtures.

## Usage

### Editors (nvim-treesitter, Zed, Helix, ...)

Point your editor's tree-sitter integration at this repository. The parser
name is `deka`; `tree-sitter.json` maps both `ds` and `dsx` file types.
Query paths are `queries/highlights.scm`, `queries/injections.scm`,
`queries/locals.scm`, and `queries/tags.scm`.

### Rust

```toml
[dependencies]
tree-sitter-deka = { git = "https://github.com/dekaruntime/tree-sitter-deka" }
```

### Node

```sh
npm install github:dekaruntime/tree-sitter-deka
```

```js
const Parser = require("tree-sitter");
const Deka = require("tree-sitter-deka");

const parser = new Parser();
parser.setLanguage(Deka);
```

### WebAssembly / Shiki

`tree-sitter build --wasm` (requires [emscripten](https://emscripten.org))
produces `tree-sitter-deka.wasm`, checked as a CI artifact. The website and
tour highlight with [Shiki](https://shiki.style); Shiki does not consume
tree-sitter grammars directly, but the wasm parses to the same CST the
queries run against, so a Shiki-compatible token stream can be produced by
running `queries/highlights.scm` over the wasm parse (via
[web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web))
and mapping capture names to Shiki themes. `queries/injections.scm` marks
`unsafe` bodies as JavaScript so they can be re-highlighted with the
JavaScript grammar the same way.

## Development

```sh
npm install          # also installs the tree-sitter CLI and the JS base grammar
npx tree-sitter generate
npx tree-sitter test
npx tree-sitter parse path/to/file.ds
npx tree-sitter query queries/highlights.scm path/to/file.dsx
```

`src/parser.c` and `src/node-types.json` are generated artifacts, checked in
per tree-sitter convention; they are regenerated in CI and never hand-edited.

## Staying in sync with upstream

When tree-sitter-typescript (or the DekaScript syntax, as implemented in
`dsc`) changes:

1. Bump the `tree-sitter-javascript` pin in `package.json` and re-diff
   `common/define-grammar.js` against the `inherited verbatim` section of
   `grammar.js`; port additions/removals.
2. Re-diff `common/scanner.h` against `scanner/scanner.h` (keeping the
   `RAW_JS` enum entry last and its scan dispatch first).
3. `npx tree-sitter generate && npx tree-sitter test`.
4. If `dsc`'s grammar surface moved (`crates/deka_syntax`), adjust the
   `DEKA-SPECIFIC` rules and add a corpus case.

## References

- [DekaScript syntax as accepted by dsc](https://github.com/dekaruntime/dsc)
  (`crates/deka_syntax`)
- [tree-sitter-typescript](https://github.com/tree-sitter/tree-sitter-typescript)
- [tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript)

## License

MIT (inherited from tree-sitter/tree-sitter-typescript).
