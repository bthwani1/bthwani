// models/delivery_Marketplace_V1/Promotion.ts
import mongoose, { Document, Schema } from "mongoose";

export type PromotionTarget = "product" | "store" | "category";
export type PromotionValueType = "percentage" | "fixed";
export type PromotionPlacement =
  | "home_hero" // سلايدر رئيسي
  | "home_strip" // شريط في الرئيسية
  | "category_header" // أعلى صفحة الفئة
  | "category_feed" // وسط صفحة الفئة
  | "store_header" // أعلى صفحة المتجر
  | "search_banner" // صفحة البحث
  | "cart" // شاشة السلة
  | "checkout"; // شاشة الدفع

export interface IPromotion extends Document {
  title?: string;
  description?: string;
  image?: string;
  link?: string; // deep-link او خارجي
  target: PromotionTarget;
  value?: number;
  valueType?: PromotionValueType;
  product?: mongoose.Types.ObjectId;
  store?: mongoose.Types.ObjectId;
  category?: mongoose.Types.ObjectId;

  // تحكم العرض
  placements: PromotionPlacement[]; // أين يظهر
  cities?: string[]; // مثال: ["Sana'a"]
  channels?: ("app" | "web")[]; // قنوات

  // قواعد الاحتساب
  stacking?: "none" | "best" | "stack_same_target";
  minQty?: number; // حد أدنى لكمية المنتج (إن وُجد)
  minOrderSubtotal?: number; // حد أدنى لقيمة الطلب
  maxDiscountAmount?: number; // سقف الخصم لهذا العرض (اختياري)

  order?: number;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
}

const promotionSchema = new Schema<IPromotion>(
  {
    title: String,
    description: String,
    image: String,
    link: String,

    target: {
      type: String,
      enum: ["product", "store", "category"],
      required: true,
    },
    value: Number,
    valueType: { type: String, enum: ["percentage", "fixed"] },
    product: { type: Schema.Types.ObjectId, ref: "DeliveryProduct" },
    store: { type: Schema.Types.ObjectId, ref: "DeliveryStore" },
    category: { type: Schema.Types.ObjectId, ref: "DeliveryCategory" },

    placements: { type: [String], default: ["home_hero"] },
    cities: { type: [String], default: [] },
    channels: { type: [String], default: ["app"] },

    stacking: {
      type: String,
      enum: ["none", "best", "stack_same_target"],
      default: "best",
    },
    minQty: Number,
    minOrderSubtotal: Number,
    maxDiscountAmount: Number,

    order: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// فهارس مفيدة للأداء
promotionSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ target: 1, product: 1, store: 1, category: 1 });
promotionSchema.index({ placements: 1, order: 1 });

export default mongoose.model<IPromotion>("DeliveryPromotion", promotionSchema);
