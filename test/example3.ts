import { join } from "node:path";
import { xdgState } from "xdg-basedir";
import { LockfileMutex } from "../src";

// biome-ignore lint/style/noNonNullAssertion: TODO
LockfileMutex.locked(join(xdgState!, "lockfile-mutex/example/lockfile"));
