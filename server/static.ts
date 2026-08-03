import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { injectSeoHead } from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // The built template is immutable for the lifetime of a deployment.
  let template: string | null = null;

  const sendInjected = (req: Request, res: Response) => {
    if (template === null) {
      template = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
    }
    const { html, status } = injectSeoHead(template, req.originalUrl, req.headers.host);
    res.status(status).set({ "Content-Type": "text/html" }).send(html);
  };

  // Direct hits on /index.html must NOT be served raw by express.static —
  // that would be a 200 duplicate of the homepage with no injected metadata.
  // Route them through the injector like any other path (classified unknown,
  // so they come back 404 + noindex).
  app.use((req, res, next) => {
    if (req.path === "/index.html") {
      sendInjected(req, res);
      return;
    }
    next();
  });

  // index:false so "/" falls through to the SEO-injecting catch-all below —
  // otherwise express.static would serve the raw template for the homepage
  // and the initial response would carry no route metadata.
  app.use(express.static(distPath, { index: false }));

  // Fall through to index.html with per-route head injection. Unknown
  // routes keep the app shell as the body (the client renders NotFound)
  // but return a real 404 status, so they can never be indexed as soft-404s.
  app.use("*", sendInjected);
}
