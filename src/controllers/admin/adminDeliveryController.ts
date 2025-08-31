// src/controllers/admin/adminDeliveryController.ts
import { Request, Response } from "express";
import Order from "../../models/delivry_Marketplace_V1/Order";
import driverReviewModel from "../../models/Driver_app/driverReview.model";

export const getDeliveryKPIs = async (req: Request, res: Response) => {
  // 1) إجمالي عدد الطلبات حسب اليوم/الأسبوع/الشهر
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyCount, weeklyCount, monthlyCount] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
  ]);

  // 2) نسبة التوصيل في الوقت المحدد (مثلاً status==="delivered" && deliveredAt <= expectedAt)
  // إذا لديك حقل expectedDeliveryAt
  const totalOrders = await Order.countDocuments();
  const onTimeCount = await Order.countDocuments({
    status: "delivered",
    $expr: { $lte: ["$deliveredAt", "$expectedDeliveryAt"] },
  });
  const onTimeRate = totalOrders ? (onTimeCount / totalOrders) * 100 : 0;

  // 3) مدة التوصيل المتوسطة
  const avgDeliveryTimeAgg = await Order.aggregate([
    { $match: { status: "delivered" } },
    { $project: { diff: { $subtract: ["$deliveredAt", "$createdAt"] } } },
    { $group: { _id: null, avgMs: { $avg: "$diff" } } },
  ]);
  const avgDeliveryTimeMs = avgDeliveryTimeAgg[0]?.avgMs || 0;

  // 4) إيرادات التوصيل: نفترض حقل cost
  const [totalCommission, revenueByStore] = await Promise.all([
    Order.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: null, total: { $sum: "$cost" } } },
    ]),
    Order.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: "$storeId", revenue: { $sum: "$cost" } } },
    ]),
  ]);

  // 5) مؤشرات السائقين:
  // متوسط تقييم السائقين
  const driverRatings = await driverReviewModel.aggregate([
    {
      $group: {
        _id: "$driverId",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  // عدد الطلبات المنجزة ونسبة الإلغاء لكل سائق
  const driverStats = await Order.aggregate([
    {
      $group: {
        _id: "$driverId",
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
        },
        canceled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
      },
    },
  ]);

  res.json({
    orders: {
      dailyCount,
      weeklyCount,
      monthlyCount,
      onTimeRate,
      avgDeliveryTimeMs,
    },
    revenue: { total: totalCommission[0]?.total || 0, byStore: revenueByStore },
    drivers: { ratings: driverRatings, stats: driverStats },
  });
  return;
};
