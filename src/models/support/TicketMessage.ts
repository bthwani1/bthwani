// models/TicketMessage.ts
import { Schema, model } from "mongoose";
const TicketMessageSchema = new Schema({
  ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true, index: true },
  author: {
    type: { type: String, enum: ["agent","user","system"], required: true },
    id: String // userId/email
  },
  isInternalNote: { type: Boolean, default: false },
  body: { type: String, required: true },
  attachments: [{ name:String, url:String, size:Number }],
}, { timestamps: { createdAt: true, updatedAt: false } });

TicketMessageSchema.index({ ticketId:1, createdAt:1 });

export default model("TicketMessage", TicketMessageSchema);
