import express from "express";
import cors from "cors";

import { healthRouter } from "./routes/health.routes.js";
import { videoRouter } from "./routes/video.routes.js";

export const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          `CORS blocked origin: ${origin}`,
        ),
      );
    },
  }),
);

app.use(express.json());

app.use(
  "/api/health",
  healthRouter,
);

app.use(
  "/api/videos",
  videoRouter,
);