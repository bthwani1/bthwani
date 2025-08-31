import mongoose, { Model, Schema, Types } from "mongoose";
import { UserType } from "../types/user.types";
export interface EmailVerification {
  codeHash: string;
  expiresAt: Date;
  channel: VerificationChannel;
  attempts: number;
}
type VerificationChannel = 'email' | 'sms' | 'whatsapp';

const EmailVerificationSchema = new Schema<EmailVerification>(
  {
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    channel: { type: String, enum: ['email', 'sms', 'whatsapp'], required: true },
    attempts: { type: Number, default: 0 },
  },
  { _id: false }
);
// 🏠 عنوان المستخدم
const AddressSchema = new mongoose.Schema({
  label: String,
  street: String,
  city: String,

  location: {
    lat: Number,
    lng: Number,
  },
});

// 💰 محفظة المستخدم
const WalletSchema = new mongoose.Schema(
  {
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "YER" },
    totalSpent: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 }, // ✅
    savings: { type: Number, default: 0 }, // ✅ الجديد

    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

// 🔐 إعدادات الأمان
const SecuritySchema = new mongoose.Schema(
  {
    pinCode: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
  },
  { _id: false }
);

// 💳 سجل المعاملات
const TransactionSchema = new mongoose.Schema(
  {
    amount: Number,
    type: { type: String, enum: ["credit", "debit"] },
    method: {
      type: String,
      enum: [
        "agent",
        "card",
        "transfer",
        "payment",
        "escrow",
        "reward",
        "kuraimi",
      ],
    }, // <-- أضف هذه
    description: String,
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

// 📘 سجل النشاطات
const ActivityLogSchema = new mongoose.Schema(
  {
    action: String,
    target: String, // post, product, message...
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  aliasName: { type: String },
  email: { type: String, unique: true },
  phone: { type: String },
  profileImage: { type: String, default: "" },
emailVerified: { type: Boolean, default: false },
  classification: {
    type: String,
    enum: ["regular","bronze","silver","gold","vip"],
    default: "regular",
  },
  negativeRatingCount: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    enum: ["user", "admin", "superadmin"],
    default: "user",
  },

  addresses: [AddressSchema],
defaultAddressId: {
  type: mongoose.Schema.Types.ObjectId,
  required: false,
},
  isVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  authProvider: {
    type: String,
    enum: ["firebase", "local"],
    default: "firebase",
  },
  firebaseUID: String,


  loginHistory: [
    {
      ip: String,
      userAgent: String,
      at: { type: Date, default: Date.now },
    },
  ],
  notificationsFeed: [
    {
      title: { type: String, required: true },
      body: { type: String, required: true },
      data: { type: mongoose.Schema.Types.Mixed }, // للإرسال بيانات إضافية مثل orderId
      isRead: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    },
  ],

  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
 



  // Settings
  language: { type: String, enum: ["ar", "en"], default: "ar" },
  theme: { type: String, enum: ["light", "dark"], default: "light" },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
  },
  isActive: { type: Boolean, default: true },
  isBlacklisted: { type: Boolean, default: false },

  pushToken: { type: String },

 

  // 💰 Wallet
  wallet: WalletSchema,

  // 🔐 Security
  security: { type: SecuritySchema, default: () => ({}) },

  // 💳 Transactions
  transactions: [TransactionSchema],
  // 📘 Activity Log
  activityLog: [ActivityLogSchema],
});
UserSchema.index({ donationLocation: "2dsphere" }, { sparse: true });

export interface UserDocument extends Document, UserType {
  emailVerified: boolean;
  emailVerification?: EmailVerification; // 👈 أضِفه هنا
  donationLocation?: {
    type: "Point";
    coordinates: [number, number];
    updatedAt?: Date;
  };
}

UserSchema.index({ createdAt: -1 });

export const User: Model<UserDocument> = mongoose.model<UserDocument>(
  "User",
  UserSchema
);
UserSchema.add({
  emailVerification: { type: EmailVerificationSchema, required: false },
});
