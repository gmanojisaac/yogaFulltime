import { createServer } from 'node:http';

export function createApp() {
  return createServer((request, response) => {
    const pathname = (request.url ?? '/').split('?')[0];
    let statusCode = 200;
    let body;

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      statusCode = 405;
      response.setHeader('Allow', 'GET, HEAD');
      body = { error: 'Method not allowed' };
    } else if (pathname === '/') {
      body = { name: 'yoga-fulltime', message: 'Welcome to Yoga Fulltime!' };
    } else if (pathname === '/health') {
      body = { status: 'ok' };
    } else {
      statusCode = 404;
      body = { error: 'Not found' };
    }

    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(request.method === 'HEAD' ? undefined : JSON.stringify(body));
  });
}
