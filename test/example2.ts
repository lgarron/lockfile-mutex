import { default as assert } from "node:assert";
import { LockfileMutex } from "../src";

const lockfileMutex = new LockfileMutex("./.temp/test/example2");

// Try to lock and check the result (`boolean`)
if (lockfileMutex.lock()) {
  // …
}

// Require a lock to succeed.
assert(lockfileMutex.lock());

// Unlock
lockfileMutex.unlock();
