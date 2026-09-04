import { Router } from "express";

import {
  createVideoJobController,
  getVideoJobController,
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