import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import type { Analysis, Options, Progress } from "../shared/model.ts";
import { diff } from "../analyzer/git.ts";
import { synthesize, selectedEvidence } from "./ai.ts";
import { explain, cochanges } from "../analyzer/evidence.ts";
export async function startServer(root: string, options: Options) {
  const token = randomBytes(32).toString("hex");
  let data: Analysis | undefined;
  let error = "";
  const progress: Progress[] = [];
  const clients = new Set<http.ServerResponse>();
  let origin = "";
  let aiBusy = false;
  const send = (res: http.ServerResponse, code: number, value: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    try {
      if (req.headers.host !== new URL(origin).host)
        return send(res, 403, { error: "Invalid host" });
      if (req.headers.origin && req.headers.origin !== origin)
        return send(res, 403, { error: "Cross-origin request denied" });
      if (req.headers["sec-fetch-site"] === "cross-site")
        return send(res, 403, { error: "Cross-site request denied" });
      const u = new URL(req.url || "/", origin);
      if (u.pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (u.pathname.startsWith("/api/")) {
        const provided = String(req.headers.authorization || "").replace(
          /^Bearer /,
          "",
        );
        if (
          provided.length !== token.length ||
          !timingSafeEqual(Buffer.from(provided), Buffer.from(token))
        )
          return send(res, 401, { error: "Session token required" });
        if (u.pathname === "/api/events" && req.method === "GET") {
          if (clients.size >= 8)
            return send(res, 429, { error: "Too many streams" });
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            Connection: "keep-alive",
          });
          for (const p of progress)
            res.write(
              `data: ${JSON.stringify({ type: "progress", data: p })}\n\n`,
            );
          res.write(
            `data: ${JSON.stringify({ type: data ? "ready" : error ? "error" : "connected", data: error || undefined })}\n\n`,
          );
          clients.add(res);
          req.on("close", () => clients.delete(res));
          return;
        }
        if (u.pathname === "/api/status")
          return send(res, 200, {
            ready: !!data,
            error,
            progress,
            ai: options.ai && !!process.env.OPENAI_API_KEY,
            model: options.model,
          });
        if (!data)
          return send(res, 409, { error: error || "Analysis in progress" });
        if (u.pathname === "/api/analysis" && req.method === "GET")
          return send(res, 200, data);
        if (u.pathname === "/api/evidence" && req.method === "GET") {
          const id = u.searchParams.get("id") || "";
          return send(res, 200, {
            ...explain(data, id),
            cochanges: cochanges(data, id),
          });
        }
        if (u.pathname === "/api/ai-preview" && req.method === "GET")
          return send(
            res,
            200,
            selectedEvidence(data, u.searchParams.get("id") || ""),
          );
        if (u.pathname === "/api/synthesize" && req.method === "POST") {
          if (!options.ai || !process.env.OPENAI_API_KEY)
            return send(res, 403, { error: "AI is disabled or unavailable" });
          if (aiBusy)
            return send(res, 429, {
              error: "A synthesis request is already running",
            });
          let raw = "";
          for await (const chunk of req) {
            raw += chunk.toString();
            if (raw.length > 4096)
              return send(res, 413, { error: "Request too large" });
          }
          const body = JSON.parse(raw);
          if (body.consent !== true || typeof body.id !== "string")
            return send(res, 400, {
              error: "Explicit evidence consent required",
            });
          aiBusy = true;
          try {
            return send(
              res,
              200,
              await synthesize(data, body.id, options.model),
            );
          } catch (e) {
            return send(res, 502, { error: (e as Error).message });
          } finally {
            aiBusy = false;
          }
        }
        if (u.pathname === "/api/diff" && req.method === "GET") {
          const from = u.searchParams.get("from") || "";
          const to = u.searchParams.get("to") || "";
          const allowed = new Set(data.checkpoints.map((c) => c.ref));
          if (!allowed.has(from) || !allowed.has(to))
            return send(res, 400, { error: "Select analyzed checkpoints" });
          if (data.demo)
            return send(res, 200, {
              diff: "Synthetic demo: inspect symbol changes and evidence in the detail panel.",
            });
          return send(res, 200, { diff: await diff(root, from, to) });
        }
        return send(res, 404, { error: "Unknown endpoint" });
      }
      if (req.method !== "GET")
        return send(res, 405, { error: "Method not allowed" });
      const assets: Record<string, string> = {
        "/": "index.html",
        "/app.js": "app.js",
        "/app.css": "app.css",
      };
      const asset = assets[u.pathname];
      if (!asset) return send(res, 404, { error: "Not found" });
      const body = await readFile(new URL(`./web/${asset}`, import.meta.url));
      res.setHeader(
        "Content-Type",
        asset.endsWith(".js")
          ? "text/javascript"
          : asset.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      res.end(body);
    } catch {
      return send(res, 400, { error: "Request could not be completed" });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 40;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Unable to listen");
  origin = `http://127.0.0.1:${address.port}`;
  const worker = new Worker(new URL("./worker.js", import.meta.url), {
    workerData: { root, options },
    resourceLimits: { maxOldGenerationSizeMb: 768 },
  });
  worker.on("message", (m) => {
    if (m.type === "progress") {
      progress.push(m.data);
      if (progress.length > 100) progress.shift();
    }
    if (m.type === "result") data = m.data;
    if (m.type === "error") error = m.data;
    const event = m.type === "result" ? { type: "ready" } : m;
    for (const c of clients) c.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  worker.on("error", () => {
    error = "Analysis worker failed. Retry with fewer checkpoints.";
    for (const c of clients)
      c.write(`data: ${JSON.stringify({ type: "error", data: error })}\n\n`);
  });
  worker.on("exit", (code) => {
    if (code !== 0 && !data) error = "Analysis worker stopped unexpectedly.";
  });
  const heartbeat = setInterval(() => {
    for (const c of clients) c.write(": heartbeat\n\n");
  }, 15000);
  heartbeat.unref();
  return {
    url: `${origin}/#${token}`,
    origin,
    token,
    server,
    close: async () => {
      clearInterval(heartbeat);
      await worker?.terminate();
      for (const c of clients) c.end();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
