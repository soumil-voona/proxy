import http from "node:http";
import { URL } from "node:url";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const target = process.env.TARGET_URL;

if (!target) {
  console.error("TARGET_URL is required, for example: TARGET_URL=http://localhost:8080 npm start");
  process.exit(1);
}

let targetUrl;
try {
  targetUrl = new URL(target);
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    throw new Error("TARGET_URL must use http or https");
  }
} catch (error) {
  console.error(`Invalid TARGET_URL: ${error.message}`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const startedAt = process.hrtime.bigint();

  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, target: targetUrl.origin }));
    return;
  }

  const upstreamUrl = new URL(request.url || "/", targetUrl);
  const headers = { ...request.headers, host: targetUrl.host, "x-forwarded-host": request.headers.host ?? "" };
  delete headers.connection;

  const upstreamRequest = http.request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || undefined,
      method: request.method,
      path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
      headers,
      timeout: 30_000
    },
    (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders.connection;
      response.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders);
      upstreamResponse.pipe(response);
    }
  );

  upstreamRequest.on("timeout", () => {
    upstreamRequest.destroy(new Error("upstream request timed out"));
  });

  upstreamRequest.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    response.writeHead(error.code === "ECONNRESET" ? 504 : 502, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ error: "upstream unavailable" }));
  });

  response.on("close", () => {
    if (!upstreamRequest.destroyed) upstreamRequest.destroy();
  });

  request.pipe(upstreamRequest);

  response.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(`${request.method} ${request.url} -> ${response.statusCode} ${elapsedMs.toFixed(1)}ms`);
  });
});

server.listen(port, () => {
  console.log(`Proxy listening on http://localhost:${port}`);
  console.log(`Forwarding to ${targetUrl.origin}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received; shutting down`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
