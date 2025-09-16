import { tmpdir } from "node:os";
import { join } from "node:path";
import { LockfileMutex } from "lockfile-mutex";
import { xdgRuntime, xdgState } from "xdg-basedir";

const dir = xdgRuntime ?? xdgState ?? tmpdir();

LockfileMutex.newLocked(join(dir, "lockfile-mutex/example/lockfile"));
