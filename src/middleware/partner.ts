import { RequestHandler } from "express";

export const requirePartner: RequestHandler = (req:any,res,next) => {
  const claimStore = req.user?.store; // من الـ JWT
  if (!claimStore) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  req.partner = { store: claimStore }; // **يُمنع تمرير store يدويًا**
  if (req.body?.store) delete req.body.store;
  next();
};
