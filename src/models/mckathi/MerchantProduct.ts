// models/MerchantProduct.ts
import { Schema, model, Types, Document } from "mongoose";

export interface IMerchantProductAttribute {
  attribute: Types.ObjectId;
  value: string;
  displayValue?: string;
}

export interface IMerchantProduct extends Document {
  merchant: Types.ObjectId;
  store: Types.ObjectId;
  product: Types.ObjectId; // ProductCatalog
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  stock?: number;
  isAvailable: boolean;
  customImage?: string;
  customDescription?: string;
  section?: Types.ObjectId;

  // جديد
  tags?: string[];
  rating?: number;
  ratingsCount?: number;

  sellingUnit?: string; // "kg", "pcs", ...
  unitSize?: number;    // 1, 0.5, 250 ...
  unitMeasure?: string; // "kg","g","l","ml","pcs"
  minQtyPerOrder?: number;
  maxQtyPerOrder?: number;
  stepQty?: number;     // 1 أو 0.5 إلخ

  avgPrepTimeMin?: number; // تغليف/استلام (عادة 0–3)

  customAttributes?: IMerchantProductAttribute[];
  createdAt: Date;
  updatedAt: Date;
}

const MerchantProductAttributeSchema = new Schema<IMerchantProductAttribute>({
  attribute: { type: Schema.Types.ObjectId, ref: "Attribute", required: true },
  value: { type: String, required: true },
  displayValue: { type: String },
});

const MerchantProductSchema = new Schema<IMerchantProduct>(
  {
    merchant: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    store:    { type: Schema.Types.ObjectId, ref: "DeliveryStore", required: true, index: true },
    product:  { type: Schema.Types.ObjectId, ref: "ProductCatalog", required: true, index: true },

    price:          { type: Number, required: true, index: true },
    originalPrice:  { type: Number },
    discountPercent:{ type: Number, default: 0 },

    stock:       { type: Number },
    isAvailable: { type: Boolean, default: true, index: true },

    customImage:       { type: String },
    customDescription: { type: String },

    section: { type: Schema.Types.ObjectId, ref: "StoreSection", index: true },

    // جديد
    tags:         { type: [String], default: [] },
    rating:       { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },

    sellingUnit:     { type: String },
    unitSize:        { type: Number },
    unitMeasure:     { type: String },
    minQtyPerOrder:  { type: Number, default: 1 },
    maxQtyPerOrder:  { type: Number, default: 0 }, // 0 = غير محدد
    stepQty:         { type: Number, default: 1 },

    avgPrepTimeMin:  { type: Number, default: 0 },

    customAttributes: [MerchantProductAttributeSchema],
  },
  { timestamps: true }
);

MerchantProductSchema.index({ store: 1, isAvailable: 1 });
MerchantProductSchema.index({ store: 1, section: 1 });

export default model<IMerchantProduct>("MerchantProduct", MerchantProductSchema);
