import { LockfileMutex } from "../src";

// Two possible outcomes:
//
// - Success: The lock will be held for the lifetime of the process and released at the end.
// - Failure: an error is thrown.
//
LockfileMutex.locked("./.temp/test/example1");
