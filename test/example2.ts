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
