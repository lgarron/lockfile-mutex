import { expect, test } from "bun:test";
import { sleep } from "bun";
import { LockfileMutex } from "lockfile-mutex";
import { Path } from "path-class";
import { existingLockfileAgeSync } from "../src/LockfileMutex";

// TODO: `nodeCleanup()` doesn't run in these tests.

test("Bare string constructor and", async () => {
  const lockfileMutex = new LockfileMutex("./.temp/lockfile");
  expect(await new Path("./.temp/lockfile").exists()).toBe(false);
  lockfileMutex.lock();
  expect(await new Path("./.temp/lockfile").exists()).toBe(true);
  lockfileMutex.unlock();
  expect(await new Path("./.temp/lockfile").exists()).toBe(false);
});

test(".lock()", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  const lockfileMutex = new LockfileMutex(lockfilePath);

  // Run through a few cycles.
  for (let i = 0; i < 3; i++) {
    expect(lockfileMutex.lockIsHeldByThisInstance).toBe(false);
    expect(lockfileMutex.lock()).toBe(true);
    expect(lockfileMutex.lock()).toBe(true);

    expect(lockfileMutex.lock({ idempotent: false })).toBe(false);
    expect(lockfileMutex.lockIsHeldByThisInstance).toBe(true);

    expect(() => lockfileMutex.unlock()).not.toThrow();
    expect(lockfileMutex.lockIsHeldByThisInstance).toBe(false);
    expect(() => lockfileMutex.unlock()).not.toThrow();
    expect(() => lockfileMutex.unlock({ idempotent: false })).toThrow();
    sleep(i * 100);
  }
});

test(".locked()", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  const { lockfileMutex, success } = LockfileMutex.newLocked(lockfilePath, {});
  expect(success).toBe(true);
  expect(lockfileMutex.lockIsHeldByThisInstance).toBe(true);
  lockfileMutex.unlock();
  expect(lockfileMutex.lockIsHeldByThisInstance).toBe(false);
});

test("contention", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  const lockfileMutex1 = new LockfileMutex(lockfilePath, {
    timeoutMilliseconds: 100,
  });
  const lockfileMutex2 = new LockfileMutex(lockfilePath, {
    timeoutMilliseconds: 100,
  });

  expect(lockfileMutex1.lock()).toBe(true);
  expect(lockfileMutex2.lock()).toBe(false);

  lockfileMutex1.unlock();
  await lockfilePath.write("");
  expect(lockfileMutex2.lock()).toBe(false);
  await sleep(110);
  expect(lockfileMutex2.lock()).toBe(true);
  expect(lockfileMutex1.lock()).toBe(false);
});

test(".locked() → errorOnLockfileFailure", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  expect(LockfileMutex.newLocked(lockfilePath).success).toBe(true);
  expect(() => LockfileMutex.newLocked(lockfilePath)).toThrow();
  expect(
    LockfileMutex.newLocked(lockfilePath, {
      errorOnLockFailure: false,
    }).success,
  ).toBe(false);
});

test("short", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  LockfileMutex.newLocked(lockfilePath, {
    timeoutMilliseconds: 10,
  });
  await sleep(105);
  expect(existingLockfileAgeSync(lockfilePath)).toBeLessThan(10);
});

test("using/dispose (constructor)", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  {
    using lockfileMutex = new LockfileMutex(lockfilePath);
    expect(lockfileMutex.lock()).toBe(true);
    expect(
      LockfileMutex.newLocked(lockfilePath, {
        errorOnLockFailure: false,
      }).success,
    ).toBe(false);
  }
  expect(
    LockfileMutex.newLocked(lockfilePath, {
      errorOnLockFailure: false,
    }).success,
  ).toBe(true);
});

test("using/dispose (never locked)", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  using _lockfileMutex = new LockfileMutex(lockfilePath);
});

test("using/dispose (`.newLocked(…)`)", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  {
    using _lockfileMutex = LockfileMutex.newLocked(lockfilePath).lockfileMutex;
    expect(
      LockfileMutex.newLocked(lockfilePath, {
        errorOnLockFailure: false,
      }).success,
    ).toBe(false);
  }
  expect(
    LockfileMutex.newLocked(lockfilePath, {
      errorOnLockFailure: false,
    }).success,
  ).toBe(true);
});

test("existingLockfileAgeSync(…)", async () => {
  const lockfilePath = (await Path.makeTempDir()).join("lockfile");
  const lockfileMutex = new LockfileMutex(lockfilePath);
  expect(() => existingLockfileAgeSync(lockfilePath)).toThrow(/^ENOENT:/);
  lockfileMutex.lock();
  expect(existingLockfileAgeSync(lockfilePath)).toBeLessThan(100); // This is usually instant, so 100ms should be long enough.
  await sleep(100);
  expect(existingLockfileAgeSync(lockfilePath)).toBeGreaterThanOrEqual(100);
});
