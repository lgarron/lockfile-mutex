import { join } from "node:path";
import { LockfileMutex } from "lockfile-mutex";
import { xdgState } from "xdg-basedir";

// biome-ignore lint/style/noNonNullAssertion: TODO
LockfileMutex.locked(join(xdgState!, "lockfile-mutex/example/lockfile"));
