// src/models/Driver_app/driver.ts

import mongoose, { Document, Schema, Types } from "mongoose";
export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}
export interface IOtherLocation {
  label:     string;
  lat:       number;
  lng:       number;
  updatedAt: Date;
}

export type DriverType = "primary" | "joker";

export interface IDriver extends Document {
  fullName: string;

  email:    string;
  password: string;
  phone:    string;
  location: IGeoPoint;

  role: "rider_driver" | "light_driver" | "women_driver";

  // متر | دراجة | سيارة
  vehicleType: "motor" | "bike" | "car";

  glReceivableAccount?: Types.ObjectId;
  glDepositAccount?: Types.ObjectId;
  // نوع المندوب من البداية
  driverType: DriverType;

  isAvailable:    boolean;
  isFemaleDriver: boolean;
  isVerified:     boolean;
  isBanned:       boolean;

  currentLocation: {
    lat:       number;
    lng:       number;
    updatedAt: Date;
  };

  residenceLocation: {
    lat:        number;
    lng:        number;
    address:    string;
    governorate:string;
    city:       string;
  };

  otherLocations: IOtherLocation[];

  wallet: {
    balance:     number;
    earnings:    number;
    lastUpdated: Date;
  };

  deliveryStats: {
    deliveredCount:  number;
    canceledCount:   number;
    totalDistanceKm: number;
  };

  // حقول متعلقة فقط إذا كان من نوع "joker"
  jokerFrom?: Date;
  jokerTo?:   Date;
}

const OtherLocationSchema = new Schema<IOtherLocation>(
  {
    label:     { type: String, required: true },
    lat:       { type: Number, required: true },
    lng:       { type: Number, required: true },
    updatedAt: { type: Date,   default: Date.now }
  },
  { _id: false }
);

const DriverSchema = new Schema<IDriver>(
  {
    fullName: { type: String, required: true },

    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone:    { type: String, required: true, unique: true },

    role: {
      type: String,
      enum: ["rider_driver", "light_driver", "women_driver"],
      required: true
    },

    vehicleType: {
      type: String,
      enum: ["motor", "bike", "car"],
      required: true
    },

    // هنا نختار "primary" أو "joker" عند الإنشاء
    driverType: {
      type: String,
      enum: ["primary", "joker"],
      required: true,
      default: "primary"
    },
location: {
  type: {
    type: String,
    enum: ["Point"],
    default: "Point",
    required: true
  },
  coordinates: {
    type: [Number], // [lng, lat]
    required: true,
    default: [0, 0]
  }
},
glReceivableAccount: { type: Schema.Types.ObjectId, ref: 'ChartAccount' }, // 1211-xxxxx
glDepositAccount:    { type: Schema.Types.ObjectId, ref: 'ChartAccount' }, // 2161-xxxxx (أو 1601 لو أصريت تجعلها أصل)
    isAvailable:    { type: Boolean, default: true },
    isFemaleDriver: { type: Boolean, default: false },
    isVerified:     { type: Boolean, default: false },
    isBanned:       { type: Boolean, default: false },

    currentLocation: {
      lat:       { type: Number, default: 0 },
      lng:       { type: Number, default: 0 },
      updatedAt: { type: Date,   default: Date.now }
    },

    residenceLocation: {
      lat:         { type: Number, required: true },
      lng:         { type: Number, required: true },
      address:     { type: String, required: true },
      governorate: { type: String, required: true },
      city:        { type: String, required: true }
    },

    otherLocations: { type: [OtherLocationSchema], default: [] },

    wallet: {
      balance:     { type: Number, default: 0 },
      earnings:    { type: Number, default: 0 },
      lastUpdated: { type: Date,   default: Date.now }
    },

    deliveryStats: {
      deliveredCount:  { type: Number, default: 0 },
      canceledCount:   { type: Number, default: 0 },
      totalDistanceKm: { type: Number, default: 0 }
    },

    // إذا كان من نوع joker نستعمل هذه الحقول للفترة
    jokerFrom: { type: Date },
    jokerTo:   { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model<IDriver>("Driver", DriverSchema);
DriverSchema.index({ location: "2dsphere" });
