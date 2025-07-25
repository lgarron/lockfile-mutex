import { LockfileMutex } from "lockfile-mutex";

// Two possible outcomes:
//
// - Success: The lock will be held for the lifetime of the process and released at the end.
// - Failure: an error is thrown.
//
LockfileMutex.locked("path/to/lockfile");
