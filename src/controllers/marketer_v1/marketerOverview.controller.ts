// src/controllers/marketer_v1/marketerOverview.controller.ts
import { Request, Response } from "express";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import Vendor from "../../models/vendor_app/Vendor";
import Order from "../../models/delivry_Marketplace_V1/Order"; // إن أردت بيع/طلبات لاحقًا (اختياري)

export async function getMarketerOverview(req: Request, res: Response){
  const uid = (req as any).user?.id;
  if (!uid) {
    res.status(401).json({ message: "مصادقة مطلوبة" });
    return;
  }

 

  // متاجري (أنا الذي أنشأتها) — خيار B: source='marketer' + createdByUid
  const baseMatch = { source: "marketer", createdByUid: uid };

  // إجمالي المتاجر حسب الحالة (نشط/غير نشط)
  const storeAgg = await DeliveryStore.aggregate([
    { $match: baseMatch },
    { $group: { _id: "$isActive", count: { $sum: 1 } } }
  ]);

  const storesActive = storeAgg.find(x => x._id === true)?.count || 0;
  const storesInactive = storeAgg.find(x => x._id === false)?.count || 0;
  const storesTotal = storesActive + storesInactive;

  // متاجر بانتظار التفعيل (forceClosed=true أو isActive=false)
  const storesPending = await DeliveryStore.countDocuments({
    ...baseMatch,
    $or: [{ isActive: false }, { forceClosed: true }]
  });

  // التجار المرتبطون بمتاجري
  const myStoreIds = (await DeliveryStore.find(baseMatch).select("_id").lean()).map(s => s._id);
  const vendorsAgg = await Vendor.aggregate([
    { $match: { store: { $in: myStoreIds } } },
    { $group: { _id: "$isActive", count: { $sum: 1 } } }
  ]);
  const vendorsActive = vendorsAgg.find(x => x._id === true)?.count || 0;
  const vendorsInactive = vendorsAgg.find(x => x._id === false)?.count || 0;
  const vendorsTotal = vendorsActive + vendorsInactive;

  // خط زمني بعدد المتاجر المُنشأة (آخر 30 يوم)
  const start = new Date(); start.setDate(start.getDate() - 29);
  const timeline = await DeliveryStore.aggregate([
    { $match: { ...baseMatch, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // تصنيف المتاجر حسب usageType (grocery/restaurants/...)
  const byUsage = await DeliveryStore.aggregate([
    { $match: baseMatch },
    { $group: { _id: "$usageType", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // (اختياري) KPIs بسيطة: معدل تفعيل المتاجر والتجار
  const storeActivationRate = storesTotal ? Math.round((storesActive / storesTotal) * 100) : 0;
  const vendorActivationRate = vendorsTotal ? Math.round((vendorsActive / vendorsTotal) * 100) : 0;

  res.json({
    stores: {
      total: storesTotal,
      active: storesActive,
      inactive: storesInactive,
      pendingActivation: storesPending
    },
    vendors: {
      total: vendorsTotal,
      active: vendorsActive,
      inactive: vendorsInactive
    },
    kpis: {
      storeActivationRate,
      vendorActivationRate
    },
    timeline,  // [{ _id:"2025-08-01", count:2 }, ...]
    byUsage    // [{ _id:"grocery", count:10 }, ...]
  });
}
