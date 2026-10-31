import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getSessionCookieOptions } from "./cookies";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import * as db from "../db";
import { approveContent, generateVariants, getAnalytics, insertGeneratedVariants, listCalendar, listQueue, rejectContent, runDuePublications, scheduleContent } from "../content";

function isPortAvailable(port: number): Promise<boolean> { return new Promise(resolve => { const server = net.createServer(); server.listen(port, () => server.close(() => resolve(true))); server.on("error", () => resolve(false)); }); }
async function findAvailablePort(startPort = 3000): Promise<number> { for (let port = startPort; port < startPort + 20; port++) if (await isPortAvailable(port)) return port; throw new Error(`No available port found starting from ${startPort}`); }

async function requireUser(req: Request) { return sdk.authenticateRequest(req); }
function apiError(res: Response, error: unknown) { const message = error instanceof Error ? error.message : "Unexpected error"; return res.status(400).json({ error: message }); }

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // REST compatibility routes matching the project brief.
  app.post("/api/content/generate", async (req, res) => { try { const user = await requireUser(req); const variants = await generateVariants(String(req.body?.topic || "")); return res.json({ variants, queue: await insertGeneratedVariants(user.id, variants) }); } catch (error) { return apiError(res, error); } });
  app.get("/api/content/queue", async (req, res) => { try { const user = await requireUser(req); return res.json(await listQueue(user.id)); } catch (error) { return apiError(res, error); } });
  app.put("/api/content/:id/approve", async (req, res) => { try { const user = await requireUser(req); const id = Number(req.params.id); return res.json(await approveContent(user.id, id, req.body?.body)); } catch (error) { return apiError(res, error); } });
  app.post("/api/content/:id/schedule", async (req, res) => { try { const user = await requireUser(req); const id = Number(req.params.id); return res.json(await scheduleContent(user.id, id, new Date(req.body?.scheduledAt))); } catch (error) { return apiError(res, error); } });
  app.get("/api/content/calendar", async (req, res) => { try { const user = await requireUser(req); return res.json(await listCalendar(user.id)); } catch (error) { return apiError(res, error); } });
  app.get("/api/content/analytics", async (req, res) => { try { const user = await requireUser(req); return res.json(await getAnalytics(user.id)); } catch (error) { return apiError(res, error); } });

  // Heartbeat callback: production scheduler calls this endpoint; it is intentionally idempotent.
  app.post("/api/scheduled/publish-due", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const result = await runDuePublications();
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected scheduled job failure";
      return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
    }
  });

  // Local dev login: creates a test user and session cookie without external OAuth.
  app.get("/api/auth/dev-login", async (req, res) => {
    try {
      const testOpenId = "local-dev-user";
      await db.upsertUser({
        openId: testOpenId,
        name: "Local Developer",
        email: "dev@localhost",
        loginMethod: "dev",
        lastSignedIn: new Date(),
      });
      const sessionToken = await sdk.createSessionToken(testOpenId, { name: "Local Developer", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dev login failed";
      res.status(500).json({ error: message });
    }
  });

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server); else serveStatic(app);
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

startServer().catch(console.error);
