import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.js';

test('HTTP endpoints', async (t) => {
  const server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await t.test('serves a JSON welcome response', async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), {
      name: 'yoga-fulltime',
      message: 'Welcome to Yoga Fulltime!',
    });
  });

  await t.test('reports health with query parameters', async () => {
    const response = await fetch(`${baseUrl}/health?probe=ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  await t.test('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/missing`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  });

  await t.test('rejects unsupported methods', async () => {
    const response = await fetch(`${baseUrl}/health`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
    assert.deepEqual(await response.json(), { error: 'Method not allowed' });
  });

  await t.test('supports HEAD without a response body', async () => {
    const response = await fetch(`${baseUrl}/health`, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
  });
});
