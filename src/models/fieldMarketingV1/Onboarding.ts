import { Schema, model, Types, Document } from "mongoose";

export type OnbStatus =
  | "draft"
  | "submitted"
  | "needs_fix"
  | "approved"
  | "rejected";

export interface IOnboarding extends Document {
  storeDraft: {
    name: string;
    address: string;
    category: Types.ObjectId;
    location: { lat: number; lng: number };
    image?: string;
    logo?: string;
    tags?: string[];
    usageType?: string;
  };
  ownerDraft?: { fullName?: string; phone?: string; email?: string };
  attachments?: { url: string; kind?: string; note?: string }[];
  participants: { uid: string; role?: "lead" | "support"; weight?: number }[];
  status: OnbStatus;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  notes?: string; // للـ needs_fix أو الرفض
  createdByUid: string; // منشئ الطلب (المسوّق)
}

const Sch = new Schema<IOnboarding>(
  {
    storeDraft: {
      name: { type: String, required: true },
      address: { type: String, required: true },
      category: {
        type: Schema.Types.ObjectId,
        ref: "DeliveryCategory",
        required: true,
      },
      location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      image: String,
      logo: String,
      tags: [String],
      usageType: String,
    },
    ownerDraft: {
      fullName: String,
      phone: String,
      email: String,
    },
    attachments: [{ url: String, kind: String, note: String }],
    participants: [
      {
        uid: { type: String, required: true },
        role: { type: String, enum: ["lead", "support"] },
        weight: { type: Number, min: 0, max: 1 },
      },
    ],
    status: {
      type: String,
      enum: ["draft", "submitted", "needs_fix", "approved", "rejected"],
      default: "submitted",
      index: true,
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
    createdByUid: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export default model<IOnboarding>("Onboarding", Sch);
