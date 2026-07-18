import { Router, Request, Response } from "express";
import { sendSuccess } from "../utils/response";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  sendSuccess(res, null, "API is running");
});

export default router;
