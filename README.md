# `lockfile-mutex`

Implementation a of a mutex using lockfile on the filesystem. If you use the
same lockfile mutex path in two invocations of code, then only one of them
will be able to run at a time.

This is useful for long-lived processes where only one should be active at a
time, such as a daemon or a backup process.

For example, you might want to run a backup process once per hour, but the
backup might take multiple hours in some cases. A lockfile mutex will prevent
a new backup from starting until the previous one has finished.

## Simple usage

```ts
import { LockfileMutex } from "lockfile-mutex";

// Two possible outcomes:
//
// - Success: The lock will be held for the lifetime of the process and released at the end.
// - Failure: an error is thrown.
//
LockfileMutex.locked("path/to/lockfile");
```

## Advanced usage

```ts
import { default as assert } from "node:assert";
import { LockfileMutex } from "lockfile-mutex";

const lockfileMutex = new LockfileMutex("path/to/lockfile");

// Try to lock and check the result (`boolean`)
if (lockfileMutex.lock()) {
  // …
}

// Require a lock to succeed.
assert(lockfileMutex.lock());

// Unlock
lockfileMutex.unlock();
```

## Lockfile location

If you need to place a lockfile in a consistent location, consider the user's [XDG state directory](https://specifications.freedesktop.org/basedir-spec/latest/#basics):

```ts
import { join } from "node:path";
import { xdgState } from "xdg-basedir";
import { LockfileMutex } from "lockfile-mutex";

const { success } = LockfileMutex.locked(join(xdgState, "example/lockfile"));
```

If you need to coordinate across multiple users on a system, you will need to select a common path that they all have access to (e.g. under `/tmp/`).

## Intermediate directories

Note that `lockfile-mutex` will create intermediate directories to a lockfile if needed. To avoid debugging issues and edge cases, these intermediate directories are *not* cleaned afterwards.
