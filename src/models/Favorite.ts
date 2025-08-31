// models/Favorite.ts
import { Schema, model, Types } from "mongoose";

export type FavoriteType = "product" | "restaurant";

const FavoriteSchema = new Schema(
  {
    user:     { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    item:     { type: Schema.Types.ObjectId, required: true, index: true },
    itemType: { type: String, enum: ["product", "restaurant"], required: true, index: true },

    // اختياري: سنابشوت للعرض السريع بدون populate
    itemSnapshot: {
      title: String,
      image: String,
      price: Number,
      rating: Number,
    },
  },
  { timestamps: true }
);

// منع التكرار لنفس (user,item,itemType)
FavoriteSchema.index({ user: 1, item: 1, itemType: 1 }, { unique: true });

export default model("Favorite", FavoriteSchema);
