import { expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { sleep } from "bun";
import { LockfileMutex } from "lockfile-mutex";
import { existingLockfileAgeSync } from "../src/LockfileMutex";

// TODO: `nodeCleanup()` doesn't run in these tests.

test(".lock()", async () => {
  await rm("./.temp/test/.lockfile1", { force: true });
  const lockfileMutex = new LockfileMutex("./.temp/test/.lockfile1");

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
  await rm("./.temp/test/.lockfile2", { force: true });
  const { lockfileMutex, success } = LockfileMutex.newLocked(
    "./.temp/test/.lockfile2",
    {},
  );
  expect(success).toBe(true);
  expect(lockfileMutex.lockIsHeldByThisInstance).toBe(true);
  lockfileMutex.unlock();
  expect(lockfileMutex.lockIsHeldByThisInstance).toBe(false);
});

test("contention", async () => {
  await rm("./.temp/test/.lockfile3", { force: true });
  const lockfileMutex1 = new LockfileMutex("./.temp/test/.lockfile3", {
    timeoutMilliseconds: 100,
  });
  const lockfileMutex2 = new LockfileMutex("./.temp/test/.lockfile3", {
    timeoutMilliseconds: 100,
  });

  expect(lockfileMutex1.lock()).toBe(true);
  expect(lockfileMutex2.lock()).toBe(false);

  lockfileMutex1.unlock();
  await writeFile("./.temp/test/.lockfile3", "");
  expect(lockfileMutex2.lock()).toBe(false);
  await sleep(110);
  expect(lockfileMutex2.lock()).toBe(true);
  expect(lockfileMutex1.lock()).toBe(false);
});

test(".locked() → errorOnLockfileFailure", async () => {
  await rm("./.temp/test/.lockfile4", { force: true });
  expect(LockfileMutex.newLocked("./.temp/test/.lockfile4").success).toBe(true);
  expect(() => LockfileMutex.newLocked("./.temp/test/.lockfile4")).toThrow();
  expect(
    LockfileMutex.newLocked("./.temp/test/.lockfile4", {
      errorOnLockFailure: false,
    }).success,
  ).toBe(false);
});

test("short", async () => {
  await rm("./.temp/test/.lockfile5", { force: true });
  LockfileMutex.newLocked("./.temp/test/.lockfile5", {
    timeoutMilliseconds: 10,
  });
  await sleep(105);
  expect(existingLockfileAgeSync("./.temp/test/.lockfile5")).toBeLessThan(10);
});

test("using/dispose (constructor)", async () => {
  await rm("./.temp/test/.lockfile6", { force: true });
  {
    using lockfileMutex = new LockfileMutex("./.temp/test/.lockfile6");
    expect(lockfileMutex.lock()).toBe(true);
    expect(
      LockfileMutex.newLocked("./.temp/test/.lockfile6", {
        errorOnLockFailure: false,
      }).success,
    ).toBe(false);
  }
  expect(
    LockfileMutex.newLocked("./.temp/test/.lockfile6", {
      errorOnLockFailure: false,
    }).success,
  ).toBe(true);
});

test("using/dispose (never locked)", async () => {
  await rm("./.temp/test/.lockfile7", { force: true });
  using _lockfileMutex = new LockfileMutex("./.temp/test/.lockfile6");
});

test("using/dispose (`.newLocked(…)`)", async () => {
  await rm("./.temp/test/.lockfile8", { force: true });
  {
    using _lockfileMutex = LockfileMutex.newLocked(
      "./.temp/test/.lockfile8",
    ).lockfileMutex;
    expect(
      LockfileMutex.newLocked("./.temp/test/.lockfile8", {
        errorOnLockFailure: false,
      }).success,
    ).toBe(false);
  }
  expect(
    LockfileMutex.newLocked("./.temp/test/.lockfile8", {
      errorOnLockFailure: false,
    }).success,
  ).toBe(true);
});
