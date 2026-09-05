import { Router } from "express";

import {
  createVideoJobController,
  getVideoJobController,
  getVideoShorts,
streamShortVideo,
createShortMetadata,
} from "../controllers/video.controller.js";

export const videoRouter = Router();

videoRouter.post(
  "/",
  createVideoJobController,
);

videoRouter.get(
  "/:jobId",
  getVideoJobController,
);
videoRouter.get(
  "/:jobId/shorts",
  getVideoShorts,
);

videoRouter.get(
  "/:jobId/shorts/:shortId/video",
  streamShortVideo,
);
videoRouter.post(
  "/:jobId/shorts/:shortId/metadata",
  createShortMetadata,
);