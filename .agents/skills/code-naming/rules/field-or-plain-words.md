# field-or-plain-words

**Use the standard term of the field, or an everyday word. Don't use a word coined in the session, internal jargon, or an abbreviation the field doesn't use.**

A reader brings two vocabularies to the code: the field's (the domain, the language, the protocols and tools it uses) and everyday English. A word from either means something to them before they read a line. A coined word means nothing to anyone who wasn't there when it was coined, including the person who reviews it.

## What to check

- **The field's term first.** When the domain has a standard term for the concept, use it. This covers the business domain (finance, trading, storage) and the technical ones: the language's own naming conventions for conversions, constructors and predicates, protocol and format terms, and Unix and tool conventions.
- **Then a plain word.** When the field has no term, use an everyday word that says what the thing is.
- **No coinages.** No words invented while writing the code: metaphors for concrete things, nicknames, shorthand that grew up in a conversation, stage or tier labels without a definition.
- **No jargon from outside the field.** A term of art from an unrelated field, or a word a single upstream project uses for its own internals, is jargon to this codebase's readers.
- **Abbreviations.** Spell words out unless the field's abbreviation is the standard form. When the field abbreviates, use its abbreviation exactly.
- **Single-letter names.** Keep them for the conventions that make them clear (loop indices, the variables of a published formula); give every other value a real name.

## Limits

- When the field's term is less self-explanatory than a plain word, the field's term still wins. Readers who know the field will look for it, and others can learn it once.
- Abstract concepts and products (a protocol, a product, a broad idea that no existing word covers) can take a metaphor or brand name. Those names are defined once and introduced on purpose; they are not coinages.
- Wire formats under real size constraints can use short keys when the mapping is defined in one place.

## Examples

Coined words replaced:

- `bag` -> `SubmissionBatch`: "bag" was shorthand from a conversation. The codebase already had the type.
- `r`, `k`, `C` -> `FeeRate`, `ClockGain`, `ClockCap`: single letters from a spec's formulas get real names in code.
- `restate_terms` -> `change_terms`: "change" is the plain word, and the spec already used it.

The field's word:

- `Side::Bid`, `Side::Ask` -> `Side::Buy`, `Side::Sell`: bid and ask name quotes. Orders have a buy or sell side.
- `compact_str` -> `to_compact_str`: Rust uses the `to_` prefix for conversions.
- `PageMeta` -> `PageMetadata`: spell the word out, since "meta" isn't the field's standard form.
