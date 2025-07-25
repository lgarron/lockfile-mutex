import { default as assert } from "node:assert";
import { join } from "node:path";
import { LockfileMutex } from "lockfile-mutex";
import { xdgState } from "xdg-basedir";

assert(xdgState); // Or handle otherwise.

LockfileMutex.locked(join(xdgState, "lockfile-mutex/example/lockfile"));
