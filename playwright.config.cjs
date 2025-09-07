// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
  },
  webServer: {
    command: 'node ./tests/run-webserver.cjs',
    port: 4321,
    reuseExistingServer: true,
    timeout: 60_000,
  },
};

module.exports = config;
