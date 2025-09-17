// models/Favorite.ts
import { Schema, model, Types } from "mongoose";

export type FavoriteType = "product" | "restaurant";

const FavoriteSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    item: { type: Schema.Types.ObjectId, required: true, index: true },
    itemType: {
      type: String,
      enum: ["product", "restaurant"],
      required: true,
      index: true,
    },

    // سنابشوت للعرض السريع
    itemSnapshot: {
      title: String,
      image: String,
      price: Number,
      rating: Number,
      // 👇 جديد: ليس إلزاميًا — مفيد لمنتجات المفضلة لفتح صفحة المتجر
      storeId: { type: Schema.Types.ObjectId, ref: "DeliveryStore" },
      storeType: { type: String, enum: ["grocery", "restaurant"] },
    },
  },
  { timestamps: true }
);

FavoriteSchema.index({ user: 1, item: 1, itemType: 1 }, { unique: true });

export default model("Favorite", FavoriteSchema);
