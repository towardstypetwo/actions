# one-concept-one-word

**Use one word for one concept everywhere it appears, and avoid letting one word mean two things.**

The rule runs both ways. When two words name one concept, the reader wonders how they differ and goes looking for a difference that isn't there. When one word names two concepts, the reader picks the wrong one. Both make the reader stop and check instead of read.

## Same concept, same word

- One concept keeps one word across every surface it appears on: identifiers, file and module names, database schema, wire format, config keys, docs, specs and UI.
- Paired operations use matching forms: the same word order, the same verb family, the same suffixes.
- A field, its type and its column agree. When a type has a name, fields holding it use the same word.
- When a doc or spec has already built up a term, the code uses that term, and the reverse.
- Before adding a word, search the codebase and docs for the concept. If it already has a word, use it. If the existing word is wrong, rename it everywhere rather than adding a second.

## One word, one meaning

- Before using a word, check what it already means in this codebase: an existing type, module, command, parameter or term in the docs. A new meaning for a word in use is a collision.
- Check what it means in the field and in the tools the project depends on: a standard term in the domain, a well-known type in the language's standard library or a common dependency, a command on the user's path. Using it for something else misleads anyone who knows the field.
- Within one interface, parameters and fields don't reuse a word that the same interface uses for something else.

## Limits

- Consistency serves only a word that passes the other rules. An earlier commit, a spec draft or an agent's choice is not a precedent for a word that fails them; rename it instead of copying it.
- Two words for two concepts that are related but distinct is correct, not inconsistent. Keep them apart, and make the difference clear in their definitions.
- A collision far outside the project's domain (a word that means something else in an unrelated field) isn't worth avoiding.

## Examples

Same concept, same word:

- `occurred_at` -> `created_at`: `created_at` is the usual name for when a row was created, so every table uses it for that timestamp.
- `file_read` -> `read_file`: it pairs with `build_file`, so it takes the same verb-first order.
- `CreateStream` -> `RegisterEventStream`: it sits next to `RegisterEventSchema`. One verb for every registration.
- `type` (column) -> `content_type`: the wire format already called the same value `content_type`.
- `VaultTarget` -> `VaultPointer`: the HTML attribute that carries it is `data-vault-pointer`.
- `entries()` -> `resources_iter()`, `entry_at` -> `resource_at`: the codebase already called these resources. "Entry" was a second word for the same thing.
- `stamp` -> `base_fee`: the docs had already defined "base fee", so the code uses it too.

One word, one meaning:

- `Volume` -> `TotalLots`: in trading, volume means traded volume. This is a sum of resting lots.
- `Bytes` -> `ByteCount`: `Bytes` is already a common buffer type in the language's ecosystem.
- `plan` (skill) -> `write-plan`: a built-in skill already has the name `plan`.
