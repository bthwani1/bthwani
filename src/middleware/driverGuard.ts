// middleware/driverGuard.ts
import { RequestHandler } from "express";
export const requireDriverSelf: RequestHandler = (req:any,res,next) => {
  const authId = req.user?.driverId;               // من الـJWT
  const paramId = req.params.id;
  if (!authId || authId !== paramId) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
};
