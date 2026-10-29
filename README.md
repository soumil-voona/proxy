# proxy

A tiny reverse HTTP proxy built with Node.js. It forwards requests to one configured upstream, preserves request bodies and response headers, logs latency, and exposes a health endpoint.

## Run

```bash
TARGET_URL=https://httpbin.org npm start
```

The proxy listens on `http://localhost:3000` by default. Change the listener with `PORT`.

```bash
PORT=8080 TARGET_URL=http://localhost:9000 npm start
```

## Endpoints

- `GET /healthz` returns `{"ok":true,...}` without contacting the upstream.
- Every other path and HTTP method is forwarded to `TARGET_URL`.

The project intentionally has no runtime dependencies and requires Node.js 18 or newer.
