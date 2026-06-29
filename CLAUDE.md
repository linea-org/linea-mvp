# Agent Rules

These rules apply to every file touched in this repo. Follow them strictly — do not deviate.

## Comments
- Only add a comment when the WHY is non-obvious: a hidden constraint, a subtle invariant, a specific bug workaround.
- Never explain what the code does — well-named identifiers already do that.
- No multi-line comment blocks. One short line max.

## Formatting
- All text (code, strings, comments) must be continuous — no blank lines inside a function or block body.
- A single blank line between top-level declarations is fine. Inside a function, never.

## Icons
- Never use Lucide React (`lucide-react`). Use `@hugeicons/react` exclusively.

## File structure
- Each file owns one feature or logical concern. When a second concern appears, create a new file.
- Name files after what they do, not what they contain (`use-execution-stream.ts`, not `hooks.ts`).
- Co-locate related types, hooks, and helpers with the feature they serve rather than dumping them in a shared `utils/`.

## Code size
- Write the minimum code that correctly solves the problem. If the same outcome is achievable in fewer lines without sacrificing clarity, write fewer lines.
- No abstraction until there are at least three concrete use-sites. Duplication is cheaper than the wrong abstraction.
- No optional parameters, overloads, or config objects added for future flexibility — design for what is needed now.

## Error handling
- Throw errors instead of silently falling back to a wrong value. A loud failure is always better than silent incorrect data.
- Only validate at system boundaries (user input, external API responses). Trust internal code and framework guarantees.
- Never swallow errors in a catch block without re-throwing or surfacing them.

## Output quality
- Type-check before reporting done: `npx tsc --noEmit`.
- Never leave `console.log`, `TODO`, `FIXME`, debug artefacts, or placeholder comments in final output.
- No test stubs or dummy implementations in production code paths.
- Never generate documentation files (`*.md`) unless explicitly asked.

## React
- Prefer server components. Only add `"use client"` when browser APIs or interactivity require it.
- Keep components small — if a component needs more than one screen to read, split it.
- Co-locate state as close to where it is used as possible. Lift only when truly shared.
- No prop drilling beyond two levels — use context or a dedicated hook.

## TypeScript
- No `any` unless interfacing with an untyped external boundary, and even then confine it to one cast at the boundary.
- Prefer `type` over `interface` for object shapes that won't be extended. Use `interface` for contracts that will be implemented or extended.
- Never cast with `as` to paper over a type error — fix the type.

## Branching and commits
- One branch per issue: `fix/<ticket>-<slug>` or `feat/<ticket>-<slug>`.
- Open a PR before moving on. Never bulk-commit unrelated changes to `main`.
- No co-authorship lines in commit messages.
- Resolve merge conflicts by understanding both sides — never blindly accept one side.
