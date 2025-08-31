import mongoose, { Schema, Types, Document } from "mongoose";

export type DispatchOfferStatus = "pending" | "accepted" | "expired" | "canceled";

export interface IDispatchOffer extends Document {
  order: Types.ObjectId;
  subOrder?: Types.ObjectId | null;
  driver: Types.ObjectId;
  status: DispatchOfferStatus;
  distanceKm?: number;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date | null;
}

const DispatchOfferSchema = new Schema<IDispatchOffer>({
  order:     { type: Schema.Types.ObjectId, ref: "DeliveryOrder", required: true },
  subOrder:  { type: Schema.Types.ObjectId, required: false },
  driver:    { type: Schema.Types.ObjectId, ref: "Driver", required: true },
  status:    { type: String, enum: ["pending","accepted","expired","canceled"], default: "pending" },
  distanceKm:{ type: Number },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },     // لكل عرض مدة صلاحية
  acceptedAt:{ type: Date, default: null },
});

// منع التكرار لنفس (order/sub,driver)
DispatchOfferSchema.index({ order:1, subOrder:1, driver:1 }, { unique: true });
// TTL: يحذف الوثيقة عند حلول expiresAt
DispatchOfferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IDispatchOffer>("DispatchOffer", DispatchOfferSchema);
