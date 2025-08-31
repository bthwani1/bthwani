import { Router } from "express";
import { Request, Response } from "express";

import * as controller from "../../controllers/vendor_app/vendor.controller";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import { requireRole } from "../../middleware/auth";
import { verifyAdmin } from "../../middleware/verifyAdmin";
import { addVendor } from "../../controllers/admin/vendorController";
import Vendor from "../../models/vendor_app/Vendor";
import Order from "../../models/delivry_Marketplace_V1/Order";
import { verifyVendorJWT } from "../../middleware/verifyVendorJWT";
import MerchantProduct from "../../models/mckathi/MerchantProduct";

const router = Router();

// كل المسارات هنا محمية بمستخدم مسجّل من نوع vendor
router.get("/", verifyFirebase, verifyAdmin, controller.listVendors);
// جلب بيانات التاجر (vendor نفسه)
router.get("/vendor/me", controller.getMyProfile);

router.post('/auth/vendor-login', controller.vendorLogin);

// تعديل بيانات التاجر (fullName, phone, إلخ)
router.put(
  "/vendor/me",
  // تحقق من صحة الحقول هنا
  controller.updateMyProfile
);
router.post("/", verifyFirebase, verifyAdmin, addVendor);
// إضافة متجر جديد (مثلاً يربط vendor بمتجر)
// body: { storeId: ObjectId }
router.post("/vendor/stores", controller.attachStoreToVendor);

// حذف الربط أو تعطيل المتجر الخاص بالتاجر
router.delete("/vendor/stores/:storeId", controller.detachStoreFromVendor);
router.get(
  "/merchant/reports",
  verifyFirebase,
  requireRole(["vendor"]),
  controller.getMerchantReports
);
router.post('/push-token', async (req, res) => {
  const { vendorId, expoPushToken } = req.body;
  // خزنه عندك بجدول vendor أو user
  await Vendor.updateOne({ _id: vendorId }, { expoPushToken });
  res.json({ success: true });
});
router.get("/dashboard/overview", verifyVendorJWT, async (req: Request, res: Response) => {
  try {
    // احصل على المتجر الخاص بالتاجر من التوكن
    const vendor = await Vendor.findById(req.user.id).lean();
    if (!vendor || !vendor.store) {
      res.status(404).json({ message: "لا يوجد متجر مرتبط بهذا التاجر" });
      return;
    }
    const storeId = vendor.store;

    // مبيعات اليوم/الأسبوع/الشهر
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    async function salesStats(from: Date) {
      const stats = await Order.aggregate([
        { $match: { "subOrders.store": storeId, status: "delivered", createdAt: { $gte: from } } },
        { $group: { _id: null, totalSales: { $sum: "$price" }, ordersCount: { $sum: 1 } } }
      ]);
      return stats[0] || { totalSales: 0, ordersCount: 0 };
    }

    const day = await salesStats(startOfDay);
    const week = await salesStats(startOfWeek);
    const month = await salesStats(startOfMonth);

    // الطلبات حسب الحالة
    const statuses = await Order.aggregate([
      { $match: { "subOrders.store": storeId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const statusMap = Object.fromEntries(statuses.map(s => [s._id, s.count]));

    // المنتجات الأكثر مبيعًا (من merchantproducts فقط)
   const topProducts = await Order.aggregate([
  { $match: { "subOrders.store": storeId, status: "delivered" } },
  { $unwind: "$subOrders" },
  { $match: { "subOrders.store": storeId } },
  { $unwind: "$subOrders.items" },
  { $match: { "subOrders.items.productType": "merchantProduct" } },
  { $group: { _id: "$subOrders.items.product", totalQuantity: { $sum: "$subOrders.items.quantity" } } },
  { $sort: { totalQuantity: -1 } },
  { $limit: 8 },
  // جلب اسم المنتج من productcatalogs
  {
    $lookup: {
      from: "productcatalogs",
      localField: "_id",
      foreignField: "_id",
      as: "productInfo"
    }
  },
  { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
  { $project: { _id: 1, totalQuantity: 1, name: "$productInfo.name" } }
]);

    // معدل التقييم العام (من rating.company)
    const rating = await Order.aggregate([
      { $match: { "subOrders.store": storeId, status: "delivered", "rating.company": { $exists: true } } },
      { $group: { _id: null, avgRating: { $avg: "$rating.company" } } }
    ]);
    const avgRating = rating[0]?.avgRating || 0;

    // المنتجات الأقل مبيعًا أو منخفضة المخزون
const allProducts = await MerchantProduct.find({ store: storeId })
  .populate("product", "name") // هكذا ستضيف الحقل name تلقائيًا!
  .lean();    // اجمع عدد مرات بيع كل منتج
    const productsStats = await Order.aggregate([
      { $match: { "subOrders.store": storeId, status: "delivered" } },
      { $unwind: "$subOrders" },
      { $match: { "subOrders.store": storeId } },
      { $unwind: "$subOrders.items" },
      { $match: { "subOrders.items.productType": "merchantProduct" } },
      { $group: { _id: "$subOrders.items.product", sold: { $sum: "$subOrders.items.quantity" } } }
    ]);
    const statsMap = Object.fromEntries(productsStats.map(p => [p._id.toString(), p.sold]));
    const lowestProducts = allProducts
  .map(p => ({
    _id: p._id,
    name: (p.product as any)?.name || "بدون اسم", // هنا ستجد الاسم في p.product.name
    stock: p.stock || 0,
    sold: statsMap[p._id.toString()] || 0
  }))
  .sort((a, b) => a.sold - b.sold || a.stock - b.stock)
  .slice(0, 8);

    // رسم بياني زمني للطلبات (30 يوم)
    const startTimeline = new Date();
    startTimeline.setDate(startTimeline.getDate() - 29);
    const timeline = await Order.aggregate([
      { $match: { "subOrders.store": storeId, createdAt: { $gte: startTimeline } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // الرد النهائي
    res.json({
      sales: { day, week, month },
      status: {
        delivered: statusMap.delivered || 0,
        cancelled: statusMap.cancelled || 0,
        preparing: statusMap.preparing || 0,
        out_for_delivery: statusMap.out_for_delivery || 0,
all: Object.values(statusMap).reduce((a, b) => (a as number) + (b as number), 0)
      },
      topProducts,
      avgRating,
      lowestProducts,
      timeline
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
