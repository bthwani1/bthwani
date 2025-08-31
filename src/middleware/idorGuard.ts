// middleware/idorGuard.ts (منع IDOR للحقول الحساسة)
import { RequestHandler } from "express";
export const guardSensitive: RequestHandler = (req:any,_res,next)=>{
  // مثال: لا تسمح بتغيير assignee/userId إن لم يكن لدى المستخدم صلاحية manage
  if (req.body?.requester?.userId && !req.user?.scopes?.includes("support:manage")) {
    delete req.body.requester.userId;
  }
  next();
};
