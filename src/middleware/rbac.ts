import { RequestHandler } from "express";

export const requireRole = (...scopes: string[]): RequestHandler => (req:any,res,next) => {
  const userScopes: string[] = req.user?.scopes || []; // عيّنها من JWT Auth middleware عندك
  const ok = scopes.every(s => userScopes.includes(s));
  if (!ok) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
};
