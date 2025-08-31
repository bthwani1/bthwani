// src/accounting/hooks.ts (أو داخل نفس Controller أعلى الملف)
import { JournalEntry } from "../models/er/journalEntry.model";
import { postOrderDelivered } from "./services/postingHelpers";

export async function postIfDeliveredOnce(order: any) {
  if (!order) return;
  if (order.status !== "delivered") return;

  // منع الترحيل المكرر: اعتمدنا أن reference=order._id و voucherType='delivery'
  const posted = await JournalEntry.exists({
    reference: order._id.toString(),
    voucherType: "delivery",
    isPosted: true,
  });
  if (posted) return;

  await postOrderDelivered(order._id.toString());
}
