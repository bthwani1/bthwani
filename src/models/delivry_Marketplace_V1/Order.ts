import mongoose, { Document, Schema, Types } from "mongoose";
type OrderType = "marketplace" | "errand" | "utility";

interface IErrandPoint {
  label: string;
  street?: string;
  city?: string;
  contactName?: string;
  phone?: string;
  location: { lat: number; lng: number };
  // اختياري: GeoJSON لتسهيل الـ $near
  geo?: { type: "Point"; coordinates: [number, number] };
}
interface IErrand {
  category: "docs" | "parcel" | "groceries" | "other";
  description?: string;
  size?: "small" | "medium" | "large";
  weightKg?: number;
  pickup: IErrandPoint;
  dropoff: IErrandPoint;
  waypoints?: Array<{ label?: string; location: { lat: number; lng: number } }>;
  distanceKm: number;
  tip?: number;
}
export interface INote {
  _id?: Types.ObjectId;
  body: string;
  visibility: "public" | "internal";
  byRole: "customer" | "admin" | "store" | "driver" | "system";
  byId?: Types.ObjectId;
  createdAt: Date;
}
const noteSchema = new Schema<INote>(
  {
    body: { type: String, required: true }, // نص الملاحظة
    visibility: {
      type: String,
      enum: ["public", "internal"], // public تظهر للعميل، internal داخلية فقط
      default: "internal",
    },
    byRole: {
      type: String,
      enum: ["customer", "admin", "store", "driver", "system"],
      required: true,
    },
    byId: { type: Schema.Types.ObjectId, required: false }, // معرف كاتب الملاحظة إن توفر
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

interface IRating {
  company: number; // 1–5
  order: number; // 1–5
  driver: number; // 1–5
  comments?: string;
  ratedAt: Date;
}

export type OrderStatus =
  | "pending_confirmation" // في انتظار تأكيد الطلب من الإدارة
  | "under_review" // قيد المراجعة → تُعطى للدليفري
  | "preparing" // قيد التحضير (داخل المطعم/المتجر)
  | "assigned" // قيد التوصيل (من الدليفري)
  | "out_for_delivery" // في الطريق إليك (من الدليفري)
  | "delivered" // تم التوصيل
  | "returned" // الا
  | "awaiting_procurement" // جديد
  | "procured" // جديد
  | "procurement_failed" // جديدرجاع (من الأدمن)
  | "cancelled"; // الالغاء (من الأدمن)
interface IStatusHistoryEntry {
  status: string;
  changedAt: Date;
  changedBy: "admin" | "store" | "driver" | "customer";
}

interface ISubOrder {
  store: Types.ObjectId;
  items: {
    product: Types.ObjectId;
    productType: string; // أو enum لو تحب
    quantity: number;
    unitPrice: number;
  }[];
  driver?: Types.ObjectId;
  deliveryReceiptNumber?: string; // رقم السند

  status: OrderStatus;
  statusHistory: IStatusHistoryEntry[];
}
export interface IOrderItem {
  productType: "merchantProduct" | "deliveryProduct";
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  store: mongoose.Types.ObjectId;
  image?: string;
}

export interface IDeliveryOrder extends Document {
  user: Types.ObjectId;
  driver?: Types.ObjectId;
  items: IOrderItem[];

  subOrders: ISubOrder[];
  price: number;
  deliveryFee: number;
  companyShare: number;
  platformShare: number;
  rating?: IRating; // إضافة حقل اختياري للتقييم
  walletUsed: number;
  cashDue: number;
  statusHistory: IStatusHistoryEntry[];
  createdAt?: Date;
  updatedAt?: Date;
  address: {
    label: string;
    street: string;
    city: string;
    location: { lat: number; lng: number };
  };
  deliveryMode: "unified" | "split";
  paymentMethod: "wallet" | "card" | "cash" | "mixed";
  paid: boolean;
  status: OrderStatus;
  returnReason?: string; // سبب الارجاع/الإلغاء
  returnBy?: "admin" | "customer" | "driver" | "store";
  scheduledFor?: Date;
  assignedAt?: Date;
  deliveryReceiptNumber?: string; // رقم السند
  orderType: OrderType; // جديد
  errand?: IErrand;
  utility?: {
    kind: "gas" | "water";
    city: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    cylinderSizeLiters?: number;
    tankerCapacityLiters?: number;
  };
  deliveredAt?: Date;
  notes?: INote[];
}

const statusHistorySchema = new Schema<IStatusHistoryEntry>(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    changedBy: {
      type: String,
      enum: ["admin", "store", "driver", "customer"],
      required: true,
    },
  },
  { _id: false }
);
const ratingSchema = new Schema<IRating>(
  {
    company: { type: Number, min: 1, max: 5, required: true },
    order: { type: Number, min: 1, max: 5, required: true },
    driver: { type: Number, min: 1, max: 5, required: true },
    comments: { type: String },
    ratedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);
const orderSchema = new Schema<IDeliveryOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    driver: { type: Schema.Types.ObjectId, ref: "Driver" },
    items: [
      {
        productType: {
          type: String,
          enum: ["merchantProduct", "deliveryProduct"],
          required: true,
        },
        productId: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        store: {
          type: Schema.Types.ObjectId,
          ref: "DeliveryStore",
          required: true,
        },
        image: { type: String },
      },
    ],

    subOrders: [
      {
        store: {
          type: Schema.Types.ObjectId,
          ref: "DeliveryStore",
          required: false,
        },
        origin: {
          label: { type: String },
          city: { type: String },
          location: { lat: Number, lng: Number },
        },
        items: [
          {
            product: { type: Schema.Types.ObjectId, required: true },
            productType: { type: String, required: true }, // أضف هذا
            quantity: Number,
            unitPrice: Number,
          },
        ],
        driver: { type: Schema.Types.ObjectId, ref: "Driver" },
        status: {
          type: String,
          enum: [
            "pending_confirmation",
            "under_review",
            "preparing",
            "out_for_delivery",
            "delivered",
            "returned",
            "cancelled",
          ],
          default: "pending_confirmation",
        },
        statusHistory: {
          type: [statusHistorySchema],
          default: [
            {
              status: "pending_confirmation",
              changedAt: new Date(),
              changedBy: "customer",
            },
          ],
        },
        deliveryReceiptNumber: {
          type: String,
          required: function () {
            return this.status === "delivered";
          },
        },
        returnReason: { type: String },
        returnBy: {
          type: String,
          enum: ["admin", "customer", "driver", "store"],
        },
      },
    ],
    rating: {
      type: ratingSchema,
      default: null,
    },
    deliveryReceiptNumber: {
      type: String,
      required: function () {
        return this.status === "delivered";
      },
    },
    price: { type: Number, required: true },
    companyShare: { type: Number, required: true }, // جديد
    platformShare: { type: Number, required: true }, // جديد
    deliveryFee: { type: Number, required: true },
    walletUsed: { type: Number, default: 0 }, // ما خصمه من المحفظة
    cashDue: { type: Number, default: 0 }, // المبلغ المتبقي يدفع كاش
    address: {
      label: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    deliveryMode: {
      type: String,
      enum: ["unified", "split"],
      default: "split",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "wallet", "card", "mixed"], // <-- أضف "mixed"
      required: true,
    },
    paid: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "pending_confirmation",
        "under_review",
        "preparing",
        "out_for_delivery",
        "delivered",
        "returned",
        "cancelled",
      ],
      default: "pending_confirmation",
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [
        {
          status: "pending_confirmation",
          changedAt: new Date(),
          changedBy: "customer",
        },
      ],
    },
    returnReason: { type: String },
    returnBy: {
      type: String,
      enum: ["admin", "customer", "driver", "store"],
    },
    scheduledFor: Date,
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.pre("findOneAndUpdate", function (next) {
  const u: any = this.getUpdate();
  if (u.status === "assigned") u.assignedAt = new Date();
  if (u.status === "delivered") u.deliveredAt = new Date();
  this.setUpdate(u);
  next();
});
orderSchema.add({
  orderType: {
    type: String,
    enum: ["marketplace", "errand", "utility"],
    default: "marketplace",
    index: true,
  },
  utility: {
    kind: { type: String, enum: ["gas", "water"] }, // نوع الخدمة
    city: { type: String },
    variant: { type: String }, // "20L" للغاز أو "small|medium|large" للماء
    quantity: { type: Number }, // الماء يسمح 0.5 (نصف)
    unitPrice: { type: Number }, // سعر الوحدة بعد التجميد
    subtotal: { type: Number }, // unitPrice * quantity
    cylinderSizeLiters: { type: Number },
    tankerCapacityLiters: { type: Number },
  },
  errand: {
    category: { type: String, enum: ["docs", "parcel", "groceries", "other"] },
    description: String,
    size: { type: String, enum: ["small", "medium", "large"] },
    weightKg: Number,
    pickup: {
      label: String,
      street: String,
      city: String,
      contactName: String,
      phone: String,
      location: { lat: Number, lng: Number },
      geo: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: undefined }, // [lng, lat]
      },
    },
    dropoff: {
      label: String,
      street: String,
      city: String,
      contactName: String,
      phone: String,
      location: { lat: Number, lng: Number },
      geo: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: undefined }, // [lng, lat]
      },
    },
    waypoints: [
      {
        label: String,
        location: { lat: Number, lng: Number },
      },
    ],
    distanceKm: Number,
    tip: Number,
  },
});

// فهارس مفيدة (اختياري):
orderSchema.index({ orderType: 1, createdAt: -1 });
orderSchema.index({ "errand.pickup.geo": "2dsphere" });
orderSchema.index({ "errand.dropoff.geo": "2dsphere" });

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "address.city": 1 });
orderSchema.index({ "subOrders.store": 1 });
orderSchema.index({ "subOrders.driver": 1 });
orderSchema.index({ "items.store": 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
export default mongoose.model<IDeliveryOrder>("DeliveryOrder", orderSchema);
