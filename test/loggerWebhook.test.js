const test = require("node:test");
const assert = require("node:assert/strict");
const Logger = require("../src/utils/logger");

test("Logger formats timestamps and prints across levels", () => {
  assert.ok(typeof Logger.now === "string");
  assert.ok(Logger.now.length > 0);

  // Calling methods should execute cleanly without throwing
  Logger.info("Test info message");
  Logger.warn("Test warn message");
  Logger.error("Test error message");
  Logger.cmd("Test cmd message");
  Logger.ready("Test ready message");
  Logger.system("Test system message");
});

test("Logger.flush executes without error when queues are empty or populated", async () => {
  Logger.info("Another info line");
  Logger.error("Another error line");
  await Logger.flush();
});
