# no-false-readings

**A name must not suggest something the thing isn't or doesn't do.**

A misleading name costs more than a vague one. A vague name makes the reader look closer; a misleading one gives them a wrong model, and they build on it. The false reading can come from the word itself, from its grammar, or from what the word means in the field.

## What to check

- **Implied type or shape.** A plural name implies a collection; a name matching an existing type implies that type; a name for a count implies a number, and a name for the things counted implies the things. The name's shape matches the value's.
- **Part of speech.** A getter or field reads as a noun, an action as a verb. A noun that can also be read as a verb (or the reverse) is a false reading at the call site.
- **Implied effect.** A function that computes, checks or previews must not use a word that implies it commits, accepts, applies or finalizes. A function that changes state must not read as a pure query.
- **Implied scope.** A name must not cover more than the thing does (all orders when it handles one account's, every release when it runs weekly) or less.
- **Field connotations.** In a domain with its own vocabulary (finance, trading, storage, cryptography, networking), check what the word means to someone in that field. A word with a specific meaning there (a financial instrument, a price, a fee, a guarantee) must not be used for something that lacks that meaning.
- **Implied guarantees.** A name must not promise a property that doesn't always hold: free, final, safe, verified, unique, sorted.

## Limits

- Every word has some loose second sense. Raise a false reading when a reader in this codebase or this field would plausibly take the wrong meaning, not when one could be constructed.
- When the only accurate name is long, a longer accurate name beats a short misleading one.

## Examples

- `settle` -> `calculate_settlement`: the function computes a settlement without applying it. "Settle" reads as final.
- `admit` -> `check`: the method only checks an input. "Admit" reads as accepting it.
- `Windows` -> `WindowGate`: a plural type name implies a collection. This is one struct that enforces the window rule.
- `clock(now)` -> `windows_until_expiry(now)`: it returns a count of windows left, not a clock.
- `seal()` -> `seal_id()`: a getter. "Seal" reads as a verb.
- `locations` -> `index`: the field's name implied the codebase's `Location` type, which it doesn't hold.
- `blocks` -> `block_count`, `bytes` -> `byte_size`: the fields hold numbers, not blocks or bytes.
- `MakerExtremes` -> `MakerBestQuotes`: "extremes" reads as the outer edge of an order book. These are the best quotes, at the inside.
- `Book::remove` -> `Book::cancel`: the method is only the cancel path, so "remove" claimed more than it does.
- `SyntheticDeposits` -> `BenchDeposits`: in a trading system "synthetic" names a kind of financial instrument. These are benchmark test data.
- `nightly-release` -> `weekly-release`: the workflow runs once a week.
