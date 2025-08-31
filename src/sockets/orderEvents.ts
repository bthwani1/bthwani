// src/sockets/orderEvents.ts
import { io } from "../index"; // نفس ما تُصدّره من index.ts

type OrderEvent =
  | "order.created"
  | "order.updated"
  | "order.status"
  | "order.sub.status"
  | "order.driver.assigned"
  | "order.sub.driver.assigned"
  | "order.pod.set"
  | "order.sub.pod.set"
  | "order.note.added";

export function emitToAdmin(event: OrderEvent, payload: any) {
  io.to("orders_admin").emit(event, { at: new Date().toISOString(), ...payload });
}

export function emitToOrder(orderId: string, event: OrderEvent, payload: any) {
  io.to(`order_${orderId}`).emit(event, { at: new Date().toISOString(), orderId, ...payload });
}

export function broadcastOrder(event: OrderEvent, orderId: string, payload: any) {
  emitToAdmin(event, { orderId, ...payload });
  emitToOrder(orderId, event, payload);
}
