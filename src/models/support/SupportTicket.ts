// models/SupportTicket.ts
import { Schema, model, Types } from "mongoose";
export type TicketStatus = "new"|"open"|"pending"|"on_hold"|"resolved"|"closed";
export type TicketPriority = "low"|"normal"|"high"|"urgent";

const SupportTicketSchema = new Schema({
  number: { type: Number, index: true }, // تسلسلي
  subject: { type: String, required: true, index: "text" },
  description: String,
  requester: {
    userId: { type: String, index: true },
    phone: String, email: String,
  },
  links: {
    orderId: { type: Schema.Types.ObjectId, ref: "DeliveryOrder", index: true },
    store: { type: Schema.Types.ObjectId, ref: "DeliveryStore", index: true },
    driver: { type: Schema.Types.ObjectId, ref: "Driver", index: true },
  },
  status: { type: String, enum: ["new","open","pending","on_hold","resolved","closed"], default:"new", index: true },
  priority: { type: String, enum: ["low","normal","high","urgent"], default:"normal", index: true },
  assignee: { type: String, index: true },    // user email/id
  group: { type: String, index: true },       // اسم الفريق
  tags: [{ type: String, index: true }],
  channel: { type: String, default: "in_app" }, // in_app/email/phone/chat/social/system
  source: { type: String, default: "user" },    // user/agent/system/automation
  firstResponseAt: Date,
  resolvedAt: Date,
  breachFirstResponse: { type: Boolean, default: false, index: true },
  breachResolve: { type: Boolean, default: false, index: true },
  slaPolicyId: { type: Schema.Types.ObjectId, ref: "SlaPolicy" },
  csatScore: Number,
  csatComment: String,
  csatSentAt: Date,
}, { timestamps: true });

SupportTicketSchema.index({ status:1, priority:1, updatedAt:-1 });
SupportTicketSchema.index({ assignee:1, status:1, updatedAt:-1 });

export default model("SupportTicket", SupportTicketSchema);
