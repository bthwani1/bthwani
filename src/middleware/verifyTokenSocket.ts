// src/middleware/verifyTokenSocket.ts
import { Socket } from "socket.io";
import admin from "firebase-admin";
import { User } from "../models/user"; // <-- تأكد من المسار

export async function verifyTokenSocket(socket: Socket, next: (err?: any) => void) {
  try {
    const token =
      (socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake.headers.authorization || "").split(" ")[1];

    if (!token) throw new Error("No Firebase token");

    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.uid = decoded.uid;

    // اجلب مستخدم DB لمعرفة الدور
    const dbUser = await User.findOne({ firebaseUID: decoded.uid })
      .select("_id role")
      .lean();

    socket.data.userId = dbUser?._id?.toString();
    socket.data.role = (dbUser?.role as any) || "customer"; // "admin" | "superadmin" | "vendor" | "driver" | "customer"
    return next();
  } catch (err) {
     next(new Error("Unauthorized"));
     return;
  }
}
