// src/utils/orderHistory.ts
import { Types } from "mongoose";
import { OrderStatus } from "../constants/orderStatus";

export type ChangedBy = "admin" | "store" | "driver" | "customer";

export function pushStatusHistory(order: any, to: OrderStatus, by: ChangedBy, reason?: string, returnBy?: ChangedBy) {
  order.statusHistory.push({
    status: to,
    changedAt: new Date(),
    changedBy: by,
  });

  if (to === "returned" || to === "cancelled") {
    order.returnReason = reason || "بدون تحديد";
    order.returnBy = (returnBy || by) as any;
  } else {
    order.returnReason = undefined;
    order.returnBy = undefined;
  }

  order.status = to;
}
