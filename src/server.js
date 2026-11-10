import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535.');
}

const server = createApp();

server.on('error', (error) => {
  console.error('Server error:', error.message);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Yoga Fulltime is listening on ${host}:${server.address().port}`);
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error('Shutdown error:', error.message);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
