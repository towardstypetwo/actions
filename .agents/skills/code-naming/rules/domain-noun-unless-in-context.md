# domain-noun-unless-in-context

**Give a generic verb or noun its object or domain. Drop any word the enclosing type, module, field, path or URL already supplies.**

A bare generic word (check, process, handle, apply, run, compute, data, info, item, value, amount, kind, type, config, utils) could mean anything, and it reads worse the farther it travels from where it was defined: imported into another file, it no longer carries the context that made it clear. Repeating what the context already says is the opposite cost: words the reader has to skip at every use.

Both halves come from one test: at the place the name is read, does the reader know what it means without an extra step?

## Add the noun

- A function named with a bare generic verb gets its object: what it checks, parses, applies or compares.
- A type named with a bare generic noun gets its domain: whose amount, which version, what kind.
- A parameter or field that holds an identifier says so when the codebase also has a type or struct for the thing itself.
- A field, flag or parameter whose bare word has more than one sensible reading gets the word that picks the right one.
- A name that will be imported or referenced outside its module carries enough of its context to stand alone there.
- Script, binary, workflow and file names get the same treatment: a name shared with a common tool or used by many projects gets a qualifier.

## Drop what the context says

- A word the enclosing type, module or crate already names is dropped from the item's own name, as long as the item is always read through that context.
- A field name doesn't repeat its struct's name; a variant doesn't repeat its enum's; a key doesn't repeat its section's.
- A word the path, URL, account or namespace already carries is dropped from the name inside it.
- A local variable read a few lines from its definition, with its type in view, can be short.
- Once a concept is established in a scope under its full name, shorter forms of it are fine within that scope.

## Limits

- Judge the name where it is read, not where it is defined. A name read mostly through its module path can be shorter than one that is imported bare.
- When adding the noun makes the name long, check first whether the thing is doing too much, or lives in the wrong module.

## Examples

Add the noun:

- `classify` -> `compare_cache_to_server`: "classify" didn't say what was compared with what.
- `walk::outgoing_links(cid, bytes)` -> `dag_traversal::direct_children(parent_cid, parent_bytes)`: module, function and parameters all name the domain, so the signature reads on its own.
- `Amount` -> `OrderAmount`: a bare `Amount` loses its meaning once it's imported into other files.
- `Quantity` -> `OrderSize`: a bare `Quantity` could be a quantity of anything.
- `Fill { order, account }` -> `Fill { order_id, account_id }`: the codebase also has `Order` and `Account` structs, and these fields hold IDs.
- `commit: CommitId` -> `commit_id: CommitId`: the field holds an ID, not a commit.
- `outgoing_refs` -> `vault_refs`: "outgoing refs" could include ordinary web links. These are only links inside the system.
- `schema_id` -> `event_schema_id`: the system has more than one kind of schema.

Drop what the context says:

- `expired: Vec<Expiry>` -> `expired: Vec<UnfilledMarketOrder>`: the field already says expired, so the element type names what the elements are.
- `cid_set_count` -> `cid_count`: the type is already a CID set.
- `IncomingTransferPolicy` -> `IncomingPolicy`: "incoming" is already the name of the transfer stream.
- `MarketMakerExtremes` -> `MakerExtremes`: once the type names establish "Market Maker", names that don't name an order type can use the short form.
- `[fingerprints.v1]` -> `[v1]`: the section is inside `fingerprints.toml`.
