import express from "express";
import cors from "cors";

import { healthRouter } from "./routes/health.routes.js";
import { videoRouter } from "./routes/video.routes.js";

export const app = express();

const clientOrigin =
  process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
  }),
);

app.use(express.json());

app.use("/api/health", healthRouter);

app.use("/api/videos", videoRouter);