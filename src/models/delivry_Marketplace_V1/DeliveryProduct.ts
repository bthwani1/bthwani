// models/DeliveryProduct.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IDeliveryProduct extends Document {
  store: mongoose.Types.ObjectId;
  subCategory?: mongoose.Types.ObjectId;
  section?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  image?: string;
  isAvailable: boolean;
  isDailyOffer: boolean;

  // جديد
  tags: string[];
  rating?: number;
  ratingsCount?: number;
  avgPrepTimeMin?: number;   // زمن تجهيز هذا الطبق
  isFeatured?: boolean;
  isTrending?: boolean;
  calories?: number;
  allergens?: string[];
  isVeg?: boolean;
  discountPercent?: number;
}

const productSchema = new Schema<IDeliveryProduct>(
  {
    store:       { type: Schema.Types.ObjectId, ref: "DeliveryStore", required: true, index: true },
    subCategory: { type: Schema.Types.ObjectId, ref: "DeliveryProductSubCategory", index: true },
    section:     { type: Schema.Types.ObjectId, ref: "StoreSection", index: true },

    name:        { type: String, required: true, index: "text" },
    description: { type: String },
    price:       { type: Number, required: true, index: true },
    originalPrice: { type: Number },
    image:       { type: String },
    isAvailable: { type: Boolean, default: true, index: true },
    isDailyOffer:{ type: Boolean, default: false, index: true },

    // جديد
    tags:           { type: [String], default: [] },
    rating:         { type: Number, default: 0 },
    ratingsCount:   { type: Number, default: 0 },
    avgPrepTimeMin: { type: Number, default: 0 },
    isFeatured:     { type: Boolean, default: false },
    isTrending:     { type: Boolean, default: false },
    calories:       { type: Number },
    allergens:      { type: [String], default: [] },
    isVeg:          { type: Boolean, default: false },
    discountPercent:{ type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ store: 1, isAvailable: 1 });
productSchema.index({ store: 1, section: 1 });
productSchema.index({ subCategory: 1 });

export default mongoose.model<IDeliveryProduct>("DeliveryProduct", productSchema);
