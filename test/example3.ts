import { LockfileMutex } from "lockfile-mutex";
import { Path } from "path-class";

const path = Path.xdg.runtimeWithStateFallback.join("example-app/lockfile");
LockfileMutex.newLocked(path);
