// routes/customers.ts  (Customer 360)
import { Router } from "express";
import MessagingPrefs from "../../models/support/MessagingPrefs";
import SupportTicket from "../../models/support/SupportTicket";
import mongoose from "mongoose";
const r = Router();

r.get("/:id/overview", async (req,res)=>{
  const userId = req.params.id;
  const DeliveryOrder = mongoose.model("DeliveryOrder"); // موجود عندك
  const [orders, tickets, prefs] = await Promise.all([
    DeliveryOrder.find({ "customer.userId": userId }).sort({ createdAt:-1 }).limit(5),
    SupportTicket.find({ "requester.userId": userId }).sort({ updatedAt:-1 }).limit(5),
    MessagingPrefs.findOne({ userId })
  ]);
  res.json({ userId, lastOrders: orders, lastTickets: tickets, prefs });
});

export default r;
