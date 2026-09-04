import { Router } from "express";

import { createVideoJobController } from "../controllers/video.controller";

export const videoRouter = Router();

videoRouter.post("/", createVideoJobController);