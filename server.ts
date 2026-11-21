import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { createWakeUpNowHandler } from "./src/server/routes/wakeUpNow";
import { runWakeUpNow } from "./src/server/pipelines/runWakeUpNow";
import { createNotionClient } from "./src/server/services/notion";
import { createOpenAIClient } from "./src/server/services/openai";
import wakeupHereHandler from "./api/wakeuphere";
import notionDataHandler from "./api/notion-data";
import productionWakeUpNowHandler from "./api/wake-up-now";
import productionWakeUpImageHandler from "./api/wake-up-image";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch local data
  app.get("/api/notion-data", async (req, res) => {
    await notionDataHandler(req, res);
  });
  app.all("/api/wakeuphere", async (req, res) => { await wakeupHereHandler(req, res); });

  app.post("/api/wake-up-now", async (req, res, next) => {
    if (req.body?.action === "complete-awakening") await productionWakeUpNowHandler(req, res);
    else next();
  });
  // All image jobs use the same persistent create-once guard as production.
  app.all("/api/wake-up-image", async (req, res) => { await productionWakeUpImageHandler(req, res); });

  app.post(
    "/api/wake-up-now",
    createWakeUpNowHandler({
      runWakeUpNow: async (request) => {
        const notionApiKey = process.env.NOTION_API_KEY;
        const databaseId = process.env.NOTION_DATABASE_ID;
        const openAiApiKey = process.env.OPENAI_API_KEY;

        if (!notionApiKey || !databaseId || !openAiApiKey) {
          throw new Error("Missing NOTION_API_KEY, NOTION_DATABASE_ID, or OPENAI_API_KEY");
        }

        return runWakeUpNow({
          request,
          databaseId,
          notion: createNotionClient({ apiKey: notionApiKey }),
          openai: createOpenAIClient({ apiKey: openAiApiKey }),
        });
      },
    }),
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
