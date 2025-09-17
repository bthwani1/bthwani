import mongoose, { Schema, Document } from "mongoose";

export type UtilityKind = "gas" | "water";
type WaterSizeKey = "small" | "medium" | "large";

export interface IUtilityPricing extends Document {
  city: string; // صنعاء، عدن...
  isActive: boolean;

  // أصل الخدمة (اختياري): إن حددته يُستخدم لحساب المسافة، وإن تركته فارغًا يمكن استخدام تسعير فلات
  origins?: {
    gas?: { label?: string; lat: number; lng: number };
    water?: { label?: string; lat: number; lng: number };
  };

  gas?: {
    enabled: boolean;
    cylinderSizeLiters: number; // افتراضي 20
    pricePerCylinder: number; // سعر الأسطوانة
    minQty?: number; // حد أدنى
    // سياسة رسوم التوصيل الخاصة بالغاز (اختيارية)
    deliveryOverride?: {
      policy: "flat" | "strategy"; // flat = مبلغ ثابت، strategy = حسب PricingStrategy + origins.gas
      flatFee?: number;
    };
  };

  water?: {
    enabled: boolean;
    sizes: Array<{
      key: WaterSizeKey; // small/medium/large
      capacityLiters: number; // سعة الوايت
      pricePerTanker: number; // سعر الوايت الكامل
    }>;
    allowHalf: boolean; // السماح بنصف وايت
    halfPricingPolicy: "linear" | "multiplier" | "fixed";
    halfLinearFactor?: number; // مثال 0.5
    halfMultiplier?: number; // مثال 0.6
    halfFixedAmount?: number; // مثال 4000 YER
    deliveryOverride?: {
      policy: "flat" | "strategy";
      flatFee?: number;
    };
  };
}

const utilityPricingSchema = new Schema<IUtilityPricing>(
  {
    city: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },

    origins: {
      gas: { label: String, lat: Number, lng: Number },
      water: { label: String, lat: Number, lng: Number },
    },

    gas: {
      enabled: { type: Boolean, default: false },
      cylinderSizeLiters: { type: Number, default: 20 },
      pricePerCylinder: { type: Number, default: 0 },
      minQty: { type: Number, default: 1 },
      deliveryOverride: {
        policy: {
          type: String,
          enum: ["flat", "strategy"],
          default: "strategy",
        },
        flatFee: { type: Number },
      },
    },

    water: {
      enabled: { type: Boolean, default: false },
      sizes: [
        {
          key: {
            type: String,
            enum: ["small", "medium", "large"],
            required: true,
          },
          capacityLiters: { type: Number, required: true },
          pricePerTanker: { type: Number, required: true },
        },
      ],
      allowHalf: { type: Boolean, default: true },
      halfPricingPolicy: {
        type: String,
        enum: ["linear", "multiplier", "fixed"],
        default: "multiplier",
      },
      halfLinearFactor: { type: Number, default: 0.5 },
      halfMultiplier: { type: Number, default: 0.6 },
      halfFixedAmount: { type: Number, default: 0 },
      deliveryOverride: {
        policy: {
          type: String,
          enum: ["flat", "strategy"],
          default: "strategy",
        },
        flatFee: { type: Number },
      },
    },
  },
  { timestamps: true }
);

utilityPricingSchema.index({ city: 1 }, { unique: true });

export default mongoose.model<IUtilityPricing>(
  "UtilityPricing",
  utilityPricingSchema
);
