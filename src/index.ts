// src/index.ts

import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server as IOServer } from "socket.io";
import adminNotificationRoutes from "./routes/admin/notification.routes";
// استيراد Middleware
import { verifyTokenSocket } from "./middleware/verifyTokenSocket";

// استيراد جوبز

// استيراد Routes
import adminRoutes from "./routes/admin/adminRoutes";
import adminWithdrawalRoutes from "./routes/admin/admin.withdrawal.routes";

import userRoutes from "./routes/userRoutes";

import mediaRoutes from "./routes/mediaRoutes";
import driverRoutes from "./routes/driver_app/driver.routes";
import adminDriverRoutes from "./routes/admin/admin.driver.routes";

import topupRoutes from "./routes/Wallet_V8/topupRoutes";

import driverWithdrawalRoutes from "./routes/driver_app/driver.withdrawal.routes";
import vendorRoutes from "./routes/vendor_app/vendor.routes";
import storeStatsRoutes from "./routes/admin/storeStatsRoutes";

import deliveryCategoryRoutes from "./routes/delivry_marketplace_v1/DeliveryCategoryRoutes";
import deliveryStoreRoutes from "./routes/delivry_marketplace_v1/DeliveryStoreRoutes";
import deliveryProductRoutes from "./routes/delivry_marketplace_v1/DeliveryProductRoutes";
import deliverySubCategoryRoutes from "./routes/delivry_marketplace_v1/DeliveryProductSubCategoryRoutes";
import deliveryBannerRoutes from "./routes/delivry_marketplace_v1/DeliveryBannerRoutes";
import DeliveryOfferRoutes from "./routes/delivry_marketplace_v1/DeliveryOfferRoutes";
import deliveryCartRouter from "./routes/delivry_marketplace_v1/DeliveryCartRoutes";
import deliveryOrderRoutes from "./routes/delivry_marketplace_v1/DeliveryOrderRoutes";
import DeliveryOrder from "./models/delivry_Marketplace_V1/Order"; // أعلى الملف

import StatestoreRoutes from "./routes/admin/storeStatsRoutes";
import employeeRoutes from "./routes/er/employee.routes";
import attendanceRoutes from "./routes/er/attendance.routes";
import leaveRequestRoutes from "./routes/er/leaveRequest.routes";
import performanceGoalRoutes from "./routes/er/performanceGoal.routes";
import pricingStrategyRoutes from "./routes/delivry_marketplace_v1/pricingStrategy";
import deliveryPromotionRoutes from "./routes/delivry_marketplace_v1/promotion.routes";
import groceriesRoutes from "./routes/marchent/api";
import storeSectionRoutes from "./routes/delivry_marketplace_v1/storeSection.routes";
import chartAccountRoutes from "./routes/er/chartAccount.routes";
import journalEntryRouter from "./routes/er/journalEntry.routes";
import journalBookRouter from "./routes/er/journals.routes";
import marketingRouter from "./routes/marketing";
import pushRouter from "./push";
import { initIndexesAndValidate } from "./bootstrap/indexes";
import { registerRoasCron } from "./cron/roas";
import { registerAdSpendCron } from "./cron/adspend";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import passwordResetRouter from "./routes/passwordReset";
import favoritesRoutes from "./routes/favorites";
import marketerStoreVendorRoutes from "./routes/marketerV1/marketerStoreVendorRoutes";
import marketerOverviewRoutes from "./routes/marketerV1/marketerOverviewRoutes";
import adminVendorModeration from "./routes/admin/vendorModerationRoutes";
import adminOnboarding from "./routes/admin/onboardingRoutes";
import adminCommission from "./routes/admin/commissionPlansRoutes";
import adminReports from "./routes/admin/reportsRoutes";

import adminMarketers from "./routes/admin/marketersRoutes";
import adminStoreModeration from "./routes/admin/storeModerationRoutes";

dotenv.config();

const app = express();
const server = http.createServer(app);
export const io = new IOServer(server, {
  cors: {
    origin: "*",
  },
});
dayjs.extend(utc); dayjs.extend(tz);
dayjs.tz.setDefault("Asia/Aden");
process.env.TZ = "Asia/Aden";
// Middleware for Socket.IO verification
io.use(verifyTokenSocket);
io.on("connection", (socket) => {
  const uid = socket.data.uid;
  if (uid) {
    socket.join(`user_${uid}`);
  }

  socket.on("disconnect", () => {
    if (uid) {
      socket.leave(`user_${uid}`);
    }
  });
});
io.on("connection", (socket) => {
  const uid = socket.data.uid;
  const role = socket.data.role;

  // يبقى كما هو:
  if (uid) socket.join(`user_${uid}`);

  // 1) غرفة الأدمن العامة
  socket.on("admin:subscribe", () => {
    if (role === "admin" || role === "superadmin") {
      socket.join("orders_admin");
    }
  });
  socket.on("admin:unsubscribe", () => {
    socket.leave("orders_admin");
  });

  // 2) غرفة طلب محدد
  socket.on("order:subscribe", async ({ orderId }: { orderId: string }) => {
    if (!orderId) return;
    try {
      const order = await DeliveryOrder.findById(orderId)
        .select("user driver subOrders.store subOrders.driver")
        .lean();
      if (!order) return;

      const isAdmin = role === "admin" || role === "superadmin";
      const isOwner = socket.data.userId && order.user?.toString() === socket.data.userId;

      // (اختياري) توسعة: السماح للسائق/التاجر — تحتاج vendorId/driverId على socket.data
      // const isOrderDriver = socket.data.driverId && order.driver?.toString() === socket.data.driverId;
      // const isSubDriver = socket.data.driverId && (order.subOrders || []).some(s => String(s.driver) === socket.data.driverId);
      // const isStore = socket.data.vendorId && (order.subOrders || []).some(s => /* تحقق ملكية المتجر */);

      if (isAdmin || isOwner /* || isOrderDriver || isSubDriver || isStore */) {
        socket.join(`order_${orderId}`);
      }
    } catch {
      /* تجاهل */
    }
  });

  socket.on("order:unsubscribe", ({ orderId }: { orderId: string }) => {
    if (orderId) socket.leave(`order_${orderId}`);
  });

  socket.on("disconnect", () => {
    if (uid) socket.leave(`user_${uid}`);
  });
});
// تفعيل CORS
app.use(
  cors({
    origin: "*", // أو حدد نطاق فرونتك فقط مثل: "https://your-app.onrender.com"
    methods: ["GET", "POST", "PUT", "DELETE","PATCH"],
    credentials: true,
  })
);

// تسجيل الولوج للطلبات في الكونسول
app.use((req, _res, next) => {
  console.log(`↔️ Incoming request: ${req.method} ${req.url}`);
  next();
});

// دعم JSON في الطلبات
app.use(express.json());
initIndexesAndValidate();

// إعداد Swagger Document مع تضمين basePath عبر تعديل خاصية servers
const API_PREFIX = "/api/v1";

// إنجاز نسخة جديدة من swaggerDocument تتضمن الـ prefix في كل server URL

// ربط Swagger UI لعرض الوثائق

// مسارات الـ API

// قسم المستخدمين والمصادقة
app.use(`${API_PREFIX}/users`, userRoutes);

// قسم الوسائط والتحميلات
app.use(`${API_PREFIX}/media`, mediaRoutes);
app.use("/api/v1", StatestoreRoutes);

app.use(`${API_PREFIX}/employees`, employeeRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/leaves`, leaveRequestRoutes);
app.use(`${API_PREFIX}/goals`, performanceGoalRoutes);
app.use(`${API_PREFIX}/accounts/chart`, chartAccountRoutes);
app.use(`${API_PREFIX}/admin/notifications`, adminNotificationRoutes);
// قسم شحن المحفظة
app.use(`${API_PREFIX}/topup`, topupRoutes);
app.use(`${API_PREFIX}/entries`, journalEntryRouter);
app.use(`${API_PREFIX}/accounts`, chartAccountRoutes);
app.use(`${API_PREFIX}/journals`, journalBookRouter);

// قسم الأدمن وإدارة المنتجات
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/admin/drivers`, adminDriverRoutes);
app.use(`${API_PREFIX}/driver`, driverRoutes);
app.use(`${API_PREFIX}/admin/withdrawals`, adminWithdrawalRoutes);
app.use(`${API_PREFIX}/admin/storestats`, storeStatsRoutes);

// قسم التوصيل والتجارة
app.use(`${API_PREFIX}/delivery/categories`, deliveryCategoryRoutes);
app.use(`${API_PREFIX}/delivery/stores`, deliveryStoreRoutes);
app.use(`${API_PREFIX}/delivery/products`, deliveryProductRoutes);
app.use(`${API_PREFIX}/delivery/offer`, DeliveryOfferRoutes);
app.use(`${API_PREFIX}/delivery/cart`, deliveryCartRouter);
app.use(`${API_PREFIX}/delivery/order`, deliveryOrderRoutes);
app.use(`${API_PREFIX}/delivery/subcategories`, deliverySubCategoryRoutes);
app.use(`${API_PREFIX}/delivery/banners`, deliveryBannerRoutes);
app.use(`${API_PREFIX}/delivery/promotions`, deliveryPromotionRoutes);
app.use(`${API_PREFIX}/delivery/sections`, storeSectionRoutes);
app.use(`${API_PREFIX}`, passwordResetRouter);
app.use(`${API_PREFIX}/favorites`, favoritesRoutes);
app.use(`${API_PREFIX}/groceries`, groceriesRoutes);

app.use(`${API_PREFIX}/push`, pushRouter);

app.use(`${API_PREFIX}/`, marketerStoreVendorRoutes);
app.use(`${API_PREFIX}/`, marketerOverviewRoutes);
app.use(`${API_PREFIX}/`, adminVendorModeration);
app.use(`${API_PREFIX}/`, adminOnboarding);
app.use(`${API_PREFIX}/`, adminCommission);
app.use(`${API_PREFIX}/`, adminReports);
app.use(`${API_PREFIX}/`, adminMarketers);
app.use(`${API_PREFIX}/`, adminStoreModeration);

// قسم طلبات وسائق التوصيل
app.use(`${API_PREFIX}/deliveryapp/withdrawals`, driverWithdrawalRoutes);

// قسم التاجر
app.use(`${API_PREFIX}/vendor`, vendorRoutes);
app.use(`${API_PREFIX}/pricing-strategies`, pricingStrategyRoutes);
app.use('/api/v1', marketingRouter);

// قسم الوظائف والمستقلين

// قسم أدوات الديباغ
app.get(`${API_PREFIX}/debug/uploads`, (_, res) => {
  const fs = require("fs");
  const path = require("path");
  const files = fs.readdirSync(path.resolve("uploads"));
  res.json({ files });
});

// مسار الجذر لفحص تشغيل السيرفر
app.get("/", (_, res) => {
  res.send("bThwani backend is running ✅");
});

// إعدادات السيرفر وقاعدة البيانات
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "";

const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(
        `📚 Documentation available at http://localhost:${PORT}/api-docs`
      );
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};
registerAdSpendCron();
registerRoasCron();

startServer();
