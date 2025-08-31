// src/middleware/verifyFirebase.ts
import { Request, Response, NextFunction } from "express";
import { adminAuth } from "../config/firebaseAdmin";

export const verifyFirebase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hdr = req.headers.authorization || "";
    const [, token] = hdr.split(" ");
    if (!token) {
      res.status(401).json({ message: "No token" });
      return;
    }

    const decoded = await adminAuth.verifyIdToken(token, true);

    (req as any).firebaseUser = decoded;

    (req as any).user = {
      uid: decoded.uid,
      id: decoded.uid,             // لتجنب لبس id/uid
      email: decoded.email,
      role: (decoded as any).role, // لو كنت تضيف كليم role مخصّص
    };

    next();
  } catch (e: any) {
    console.error("verifyFirebase error:", e?.message || e);
    res.status(401).json({ message: e?.message || "Unauthorized" });
  }
};
