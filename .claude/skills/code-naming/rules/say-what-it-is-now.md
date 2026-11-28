# say-what-it-is-now

**Name a thing for its role or contents as they are today. Leave out its mechanism, its origin, its build history and any role it may take later.**

A reader looks at a name to learn what the thing is before reading how it works. A name built from the mechanism makes them rebuild the role from the details. A name built from history (the experiment it started as, the version it replaced, the ticket it came from) describes something they can't see. A name built for a future role claims something that isn't true yet, and the reader believes it.

## What to check

- **Role over mechanism.** The name says what callers get or what the thing holds, not the algorithm, data structure or steps used to produce it. Name a function for its result or effect; name a type for the concept it represents.
- **Contents over category.** A config struct, file or module is named for the concrete thing it parses or holds, not for a broad category the reader has to narrow down.
- **No history.** No words for how the thing came about: spike, prototype, new, old, v2, temp, legacy, or the name of the thing it replaced.
- **No future roles.** If the system has one role today, the name doesn't split it into roles that don't exist yet. If a field or type is reserved for later, its name says what it holds now.
- **Whole scope.** If the thing does more than the name says, the name grows to cover it; if it does less, the name shrinks.

## Limits

- A name for something that is a mechanism by nature (a hash, a cache, a retry loop) names the mechanism, because that is what the thing is.
- When the thing's role changes, the name changes with it. A name that was right last month is not a reason to keep it.
- Room to grow belongs in types and structure, not in names that claim more than is true today.

## Examples

- `CanonicalCid` -> `SizedCid`: the type is a CID paired with its byte size. "Canonical" described how it was produced, not what it holds.
- `RawConfig` -> `RawVaultToml`: the struct parses one specific file. Name that file, not the broad category.
- `IndexerBehindLocalCache` -> `ServerBehindLocalCache`: the system has one server role today. The old name split off a role that doesn't exist yet.
- `NamespaceResponse` -> `CurrentNamespace`: the type is the namespace as it currently stands. "Response" names its transport role, not what it is.
- `FeeRateHistory` -> `FeeRateRaises`: the record stores only increases, so the name says that instead of implying every change.
- `accumulator_*` -> `balance_settlement_*` (metrics): "accumulator" is an upstream project's internal word for the mechanism. The metrics measure balance settlement.
- `namespace_events` -> `namespace_publications`: the table holds only publication events, not the full lifecycle.
