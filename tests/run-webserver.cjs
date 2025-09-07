#!/usr/bin/env node
const { spawn } = require('child_process');

// Defaults; allow override via env
process.env.PORT = process.env.PORT || '4321';
// Bind broadly by default to improve odds in restricted envs
process.env.HOST = process.env.HOST || '0.0.0.0';

const { PORT, HOST } = process.env;
console.log(`[e2e] launching web server at http://${HOST}:${PORT} …`);

const child = spawn(process.execPath, ['tests/server.cjs'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  console.log(
    `[e2e] web server exited with code=${code} signal=${signal || ''}`,
  );
  process.exit(code || 0);
});
