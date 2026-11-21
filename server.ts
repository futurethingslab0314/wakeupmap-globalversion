import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { createWakeUpImageHandler } from "./src/server/routes/wakeUpImage";
import { createWakeUpNowHandler } from "./src/server/routes/wakeUpNow";
import { runWakeUpImage } from "./src/server/pipelines/runWakeUpImage";
import { runWakeUpNow } from "./src/server/pipelines/runWakeUpNow";
import { createNotionClient } from "./src/server/services/notion";
import { createOpenAIClient } from "./src/server/services/openai";
import { createR2Client } from "./src/server/services/r2";
import wakeupHereHandler from "./api/wakeuphere";
import notionDataHandler from "./api/notion-data";

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

  app.post(
    "/api/wake-up-image",
    createWakeUpImageHandler({
      runWakeUpImage: async (request) => {
        const notionApiKey = process.env.NOTION_API_KEY;
        const databaseId = process.env.NOTION_DATABASE_ID;
        const openAiApiKey = process.env.OPENAI_API_KEY;
        const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
        const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
        const bucket = process.env.CLOUDFLARE_R2_BUCKET;
        const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

        if (!notionApiKey || !databaseId || !openAiApiKey) {
          throw new Error("Missing NOTION_API_KEY, NOTION_DATABASE_ID, or OPENAI_API_KEY");
        }
        if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrlBase) {
          throw new Error("Missing Cloudflare R2 configuration");
        }

        return runWakeUpImage({
          request,
          databaseId,
          notion: createNotionClient({ apiKey: notionApiKey }),
          openai: createOpenAIClient({ apiKey: openAiApiKey }),
          r2: createR2Client({
            endpoint,
            accessKeyId,
            secretAccessKey,
            bucket,
            publicUrlBase,
          }),
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
