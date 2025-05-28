"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
// 🏠 عنوان المستخدم
const AddressSchema = new mongoose_1.default.Schema({
    label: String,
    street: String,
    city: String,
    location: {
        lat: Number,
        lng: Number,
    },
});
// 💰 محفظة المستخدم
const WalletSchema = new mongoose_1.default.Schema({
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "YER" },
    totalSpent: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
}, { _id: false });
// 🔐 إعدادات الأمان
const SecuritySchema = new mongoose_1.default.Schema({
    pinCode: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
}, { _id: false });
// 💳 سجل المعاملات
const TransactionSchema = new mongoose_1.default.Schema({
    amount: Number,
    type: { type: String, enum: ["credit", "debit"] },
    description: String,
    date: { type: Date, default: Date.now },
}, { _id: false });
// 📘 سجل النشاطات
const ActivityLogSchema = new mongoose_1.default.Schema({
    action: String,
    target: String, // post, product, message...
    at: { type: Date, default: Date.now },
}, { _id: false });
const UserSchema = new mongoose_1.default.Schema({
    fullName: { type: String, required: true },
    aliasName: { type: String },
    email: { type: String, unique: true },
    phone: { type: String },
    profileImage: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin", "superadmin", "driver"], default: "user" },
    governorate: String,
    city: String,
    addresses: [AddressSchema],
    defaultAddress: AddressSchema,
    isAvailableForDelivery: { type: Boolean, default: false },
    currentLocation: {
        lat: { type: Number },
        lng: { type: Number },
        updatedAt: { type: Date, default: Date.now }
    },
    deliveryStats: {
        deliveredCount: { type: Number, default: 0 },
        canceledCount: { type: Number, default: 0 },
        totalDistanceKm: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 }
    },
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    authProvider: { type: String, enum: ["firebase", "local"], default: "firebase" },
    firebaseUID: String,
    postsCount: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 },
    messagesCount: { type: Number, default: 0 },
    followersCount: { type: Number, default: 0 },
    followers: { type: [String], default: [] },
    following: { type: [String], default: [] },
    loginHistory: [{
            ip: String,
            userAgent: String,
            at: { type: Date, default: Date.now }
        }],
    notificationsFeed: [{
            title: { type: String, required: true },
            body: { type: String, required: true },
            data: { type: mongoose_1.default.Schema.Types.Mixed }, // للإرسال بيانات إضافية مثل orderId
            isRead: { type: Boolean, default: false },
            createdAt: { type: Date, default: Date.now }
        }],
    favorites: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Product" }],
    isDriver: { type: Boolean, default: false },
    // Lost & Found
    lostAndFoundPosts: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "LostItem" }],
    lostStats: {
        views: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
    },
    // Blood Bank
    bloodType: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
    isAvailableToDonate: { type: Boolean, default: false },
    bloodRequests: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "BloodRequest" }],
    // Freelancing & Jobs
    isFreelancer: { type: Boolean, default: false },
    freelancerProfile: {
        type: new mongoose_1.default.Schema({
            service: { type: String, default: '' },
            bio: { type: String, default: '' },
            portfolioImages: { type: [String], default: [] }
        }, { _id: false }),
        default: () => ({})
    },
    jobPosts: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "JobOpportunity" }],
    // Bookings
    bookingPosts: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Booking" }],
    bookingStats: {
        views: { type: Number, default: 0 },
        orders: { type: Number, default: 0 },
    },
    // Settings
    language: { type: String, enum: ["ar", "en"], default: "ar" },
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    // 💰 Wallet
    wallet: WalletSchema,
    // 🔐 Security
    security: { type: SecuritySchema, default: () => ({}) },
    // 💳 Transactions
    transactions: [TransactionSchema],
    // 📘 Activity Log
    activityLog: [ActivityLogSchema],
});
exports.User = mongoose_1.default.model("User", UserSchema);
