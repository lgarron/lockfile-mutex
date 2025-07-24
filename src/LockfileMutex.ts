import "./vendor/node-cleanup.types";
import { setInterval } from "node:timers/promises";
import { default as nodeCleanup } from "node-cleanup";

// TODO: why can't we `import type` for this in a way that's compatible with
// both TypeScript and `bun`? (This blocks us from making tye imported file a
// `.d.ts` file)
import "./vendor/node-cleanup.types";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// We don't support `immediatelyLocked` because there is no way for the
// constructor to return whether the locking was successful. We could rely on
// the called to call `.isLocked` but this is not ideal. We want the lock
// success to be explicitly reflected in the return type of something the user
// *has* to call.
export interface LockfileMutexOptions {
  /** Defaults to: 60_000 */
  timeoutMilliseconds?: number;
  /** Defaults to: true */
  unlockOnProcessExit?: boolean;
}

const LOCKFILE_MUTEX_OPTIONS_DEFAULTS: Required<LockfileMutexOptions> = {
  timeoutMilliseconds: 60000,
  unlockOnProcessExit: true,
};

// This keeps the lockfile fresh even if something goes wrong with one timeout cycle.
const REFRESH_TIMEOUT_FRACTION = 0.45;

/**
 * Implementation a of a mutex using lockfile on the filesystem. If you use the
 * same lockfile mutex path in two invocations of code, then only one of them
 * will be able to run at a time.
 *
 * This is useful for long-lived processes where only one should be active at a
 * time, such as a daemon or a backup process.
 *
 * For example, you might want to run a backup process once per hour, but the
 * backup might take multiple hours in some cases. A lockfile mutex will prevent
 * a new backup from starting until the previous one has finished.
 *
 * Note:
 *
 * - This implementation uses synchronous `.lock()` and `.unlock()`
 *   implementations to simplify the model underlying the `.isLocked` state.
 * - This implementation will create intermediate directories to a lockfile if
 *   needed. To avoid debuggin issues and edge cases, these intermediate
 *   directories are *not* cleaned afterwards.
 */
export class LockfileMutex {
  #lockfilePath: string;
  #options: LockfileMutexOptions;
  get #timeoutMilliseconds(): number {
    return (
      this.#options.timeoutMilliseconds ??
      LOCKFILE_MUTEX_OPTIONS_DEFAULTS.timeoutMilliseconds
    );
  }
  get #unlockOnProcessExit(): boolean {
    return (
      this.#options.unlockOnProcessExit ??
      LOCKFILE_MUTEX_OPTIONS_DEFAULTS.unlockOnProcessExit
    );
  }

  /**
   * Usage example:
   *
   *     const lockfileMutex = new LockfileMutex("./.temp/test/.lockfile");
   *     lockfileMutex.lock();
   *
   * Unless `options.unlockOnProcessExit` is set, the lock will be released on
   * process exit. To unlock earlier, call:
   *
   *     await lockfileMutex.unlock();
   *
   */
  constructor(lockfilePath: string, options: LockfileMutexOptions = {}) {
    this.#lockfilePath = lockfilePath;
    this.#options = options;
    if (this.#unlockOnProcessExit) {
      nodeCleanup(() => {
        // The API doesn't specify that an async handler can be used here. We
        // perform a sync operation to avoid a race condition (even if it's
        // unlikely in practice).
        if (this.isLocked) {
          rmSync(this.#lockfilePath);
        }
      });
    }
  }

  /**
   * Convenience function to turn some use cases into one-liners.
   *
   *     // If this does not error, we've acquired a lock for the lifetime of the program.
   *     LockfileMutex.locked("./.temp/test/.lockfile");
   *
   *     // Query for lock success instead.
   *     const { isLocked } = LockfileMutex.locked("./.temp/test/.lockfile", { errorOnLockFailure: false });
   *
   */
  static locked(
    lockfilePath: string,
    options: LockfileMutexOptions & { errorOnLockFailure?: boolean } = {},
  ): { lockfileMutex: LockfileMutex; isLocked: boolean } {
    const lockfileMutex = new LockfileMutex(lockfilePath, options);
    const lockSucceeded = lockfileMutex.lock();
    const { isLocked } = lockfileMutex;
    if (lockSucceeded !== isLocked) {
      console.log({ lockSucceeded, isLocked });
      throw new Error("Inconsistent locking state!");
    }
    const errorOnLockFailure = options?.errorOnLockFailure ?? true;
    if (!isLocked && errorOnLockFailure) {
      throw new Error("Could not lock.");
    }
    return { lockfileMutex, isLocked };
  }

  /**
   * Returns if we have the lock when the function returns.
   *
   * - `options.idempotent` defaults to `true`.
   *   - If it is set to `false`, then `false` is also returned in the case `.isLocked` is `true`.
   *
   */
  lock(options?: { idempotent?: boolean }): boolean {
    if (this.isLocked) {
      const idempotent = options?.idempotent ?? true;
      return idempotent;
    }
    try {
      mkdirSync(dirname(this.#lockfilePath), { recursive: true });
      writeFileSync(this.#lockfilePath, "", {
        flag: "wx",
      });
    } catch (e) {
      // Note: we assume time is monotonic enough.
      if ((e as Error & { code?: string }).code !== "EEXIST") {
        throw new Error("Could not acquire lockfile mutex");
      }
      if (
        !(
          existingLockfileAgeSync(this.#lockfilePath) >
          this.#timeoutMilliseconds
        )
      ) {
        // console.info(
        //   "Lockfile mutex already exists but the timeout has not expired.",
        // );
        return false;
      }
      // console.log("Acquired lock on timeout. Continuing…");

      // Refresh timestamp.
      writeFileSync(this.#lockfilePath, "", {
        flag: "w",
      });
    }

    // Note: we invoke an `async` function here but purposely don't return it.
    this.#keepFresh();
    return true;
  }

  /**
   * - `options.idempotent` defaults to `true`. If it is set to `false`, then this function will throw an error in the case `.isLocked` is `false`.
   */
  unlock(options?: { idempotent?: boolean }): void {
    if (!this.isLocked) {
      const idempotent = options?.idempotent ?? true;
      if (!idempotent) {
        throw new Error(
          "Tried to unlock a lockfile mutex that was not actively locked.",
        );
      }
      return;
    }
    rmSync(this.#lockfilePath);
    this.#setToUnlocked();
  }

  get isLocked(): boolean {
    return !!this.#intervalAbortController;
  }

  #setToUnlocked() {
    this.#intervalAbortController?.abort();
    this.#intervalAbortController = undefined;
  }

  #intervalAbortController: AbortController | undefined;
  async #keepFresh() {
    this.#intervalAbortController = new AbortController();
    try {
      for await (const _ of setInterval(
        this.#timeoutMilliseconds * REFRESH_TIMEOUT_FRACTION,
        null,
        {
          signal: this.#intervalAbortController.signal,
          ref: false,
        },
      )) {
        if (!this.isLocked) {
          return;
        }
        // We use `async` here because this is "hot" code, i.e. code that runs
        // repeatedly, even if infrequently. This avoids a risk of blocking the
        // entire program if there is a filesystem latency hiccup.
        await writeFile(this.#lockfilePath, "", {
          flag: "w",
        });
      }
    } catch (e) {
      if ((e as Error & { code?: string }).code !== "ABORT_ERR") {
        throw e;
      }
    }
  }
}

/**
 * Assumes the given file currently exists.
 *
 * Returns: age in milliseconds
 */
export function existingLockfileAgeSync(lockfilePath: string): number {
  return Date.now() - statSync(lockfilePath).mtimeMs;
}
