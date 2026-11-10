# Yoga Fulltime

A minimal Node.js starter using ES modules and the built-in HTTP server. No runtime dependencies are required.

## Get started

Install Node.js 20.19 or later (a supported LTS release is recommended), then run:

```sh
npm install
npm run dev
```

Open <http://localhost:3000>. The development server restarts when source files change.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Start with automatic restarts |
| `npm test` | Run HTTP endpoint tests |

## Endpoints

| Method | Path | Response |
| --- | --- | --- |
| GET / HEAD | `/` | Application welcome message |
| GET / HEAD | `/health` | `{ "status": "ok" }` |

Unknown paths return JSON with status 404. Other methods return status 405.

## Configuration

The server reads `PORT` (default `3000`) and `HOST` (default `0.0.0.0`) from the environment.

For example, in PowerShell:

```powershell
$env:PORT = '4000'
npm start
```

In macOS or Linux shells:

```sh
PORT=4000 npm start
```

## Project structure

```text
src/
  app.js        # HTTP request handling
  server.js     # Startup and shutdown
test/
  app.test.js   # Endpoint tests
```

Add routes in `src/app.js` and keep server startup in `src/server.js`.
