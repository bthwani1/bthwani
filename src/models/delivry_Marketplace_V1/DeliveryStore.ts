// src/models/delivry_Marketplace_V1/DeliveryStore.ts
import mongoose, { Schema, Document } from "mongoose";

interface IWorkSchedule {
  day: string;
  open: boolean;
  from?: string;
  to?: string;
}

export type StoreUsageType = "restaurant" | "grocery" | "pharmacy" | "bakery" | "cafe" | "other";

export interface IDeliveryStore extends Document {
  name: string;
  address: string;
  category: mongoose.Types.ObjectId;
  // احتفظت بـ lat/lng كما هي لتوافق مشروعك
  location: { lat: number; lng: number };

  // جديد (اختياري): نسخة GeoJSON لو حبيت تستخدم 2dsphere
  geo?: { type: "Point"; coordinates: [number, number] };

  isActive: boolean;
  image?: string;
  logo?: string;
  forceClosed: boolean;
  forceOpen: boolean;
  schedule: IWorkSchedule[];
  commissionRate: number;
  takeCommission: boolean;
  isTrending: boolean;
  isFeatured: boolean;

  // جديد: وسم/تصنيف المتجر + فلاتر
  tags: string[];

  // جديد: تقييمات
  rating?: number;          // متوسط
  ratingsCount?: number;    // عدد التقييمات

  // جديد: تقدير التجهيز والطابور
  avgPrepTimeMin?: number;  // متوسط تجهيز افتراضي
  pendingOrders?: number;   // أو queueSize

  // جديد (اختياري): نوع المتجر لتفادي populate
  usageType?: StoreUsageType;

  // تتبّع مصدر الإنشاء
  source: "marketer" | "admin" | "system";
  createdByUid: string;  // uid من Firebase للمسوّق الذي أنشأ المتجر
  // إعدادات التسعير
  pricingStrategy?: mongoose.Types.ObjectId | null;
  pricingStrategyType: string;

  // جديد (اختياري): إعدادات توصيل
  deliveryRadiusKm?: number;
  deliveryBaseFee?: number;
  deliveryPerKmFee?: number;
  minOrderAmount?: number;

  glPayableAccount: mongoose.Types.ObjectId;
}

const storeSchema = new Schema<IDeliveryStore>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: "DeliveryCategory", required: true },

    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },

    // اختياري: GeoJSON لفهرس 2dsphere
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], index: "2dsphere", default: undefined }, // [lng, lat]
    },

    commissionRate: { type: Number, default: 0 },
    takeCommission: { type: Boolean, default: true },

    isTrending: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
  // تتبّع مصدر الإنشاء
  source: { type: String, enum: ["marketer", "admin", "system"], default: "admin", index: true },
  createdByUid: { type: String },  // uid من Firebase للمسوّق الذي أنشأ المتجر

    // فلاتر/وسوم للواجهة (فطور/غداء/عشاء/سريع...)
    tags: { type: [String], default: [] },

    // تقييمات
    rating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },

    // تجهيز + طابور (لـ estimateOrderTiming)
    avgPrepTimeMin: { type: Number, default: 0 },
    pendingOrders: { type: Number, default: 0 },

    // نوع المتجر (بديل عن أخذ usageType من الفئة)
    usageType: { type: String, enum: ["restaurant","grocery","pharmacy","bakery","cafe","other"], default: "restaurant" },

    pricingStrategy: { type: Schema.Types.ObjectId, ref: "PricingStrategy", default: null },
    pricingStrategyType: { type: String, enum: ["auto", "manual", ""], default: "" },

    // توصيل (اختياري)
    deliveryRadiusKm: { type: Number, default: 0 },
    deliveryBaseFee: { type: Number, default: 0 },
    deliveryPerKmFee: { type: Number, default: 0 },
    minOrderAmount: { type: Number, default: 0 },

    glPayableAccount: { type: Schema.Types.ObjectId, ref: "ChartAccount" },

    isActive: { type: Boolean, default: true },
    image: { type: String },
    logo: { type: String },
    forceClosed: { type: Boolean, default: false },
    forceOpen: { type: Boolean, default: false },

    schedule: [
      {
        day: { type: String, required: true },
        open: { type: Boolean, default: false },
        from: String,
        to: String,
      },
    ],
  },
  { timestamps: true }
);

// فهارس مفيدة
storeSchema.index({ isActive: 1, category: 1 });
storeSchema.index({ name: "text", address: "text" });

// لو استخدمت GeoJSON: حفظ [lng, lat] تلقائيًا من location
storeSchema.pre("save", function (next) {
  if (this.location?.lng != null && this.location?.lat != null) {
    this.geo = { type: "Point", coordinates: [this.location.lng, this.location.lat] } as any;
  }
  next();
});

export default mongoose.model<IDeliveryStore>("DeliveryStore", storeSchema);
