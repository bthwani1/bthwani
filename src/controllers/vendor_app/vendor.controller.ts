// src/controllers/vendor.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Vendor, { IVendor } from "../../models/vendor_app/Vendor";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import Order from "../../models/delivry_Marketplace_V1/Order";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const vendorLogin = async (req, res) => {
  const { phone, email, password } = req.body;
  if ((!phone && !email) || !password) {
    res.status(400).json({ error: "أدخل البريد أو الهاتف مع كلمة المرور" });
    return;
  }

  const where: any = phone ? { phone } : { email: String(email).toLowerCase() };
  const vendor = await Vendor.findOne(where);
  if (!vendor) { res.status(400).json({ error: 'بيانات الدخول غير صحيحة' }); return; }

  const isMatch = await bcrypt.compare(password, vendor.password);
  if (!isMatch) { res.status(400).json({ error: 'بيانات الدخول غير صحيحة' }); return; }

  const token = jwt.sign({ id: vendor._id, role: 'vendor' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, vendor });
};


// جلب بيانات التاجر (Vendor) بناءً على الـ userId الموجود في الـ JWT
export const getMyProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id as string;
    const vendor = await Vendor.findOne({ user: userId })
      .populate("store", "name address")
      .lean();
    if (!vendor) {
       res.status(404).json({ message: "Vendor profile not found" });
       return;
    }
    res.json(vendor);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// تعديل بيانات التاجر (fullName, phone, email)
export const updateMyProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id as string;
    const updates: Partial<IVendor> = {};
    ["fullName", "phone", "email"].forEach((field) => {
      if (req.body[field] !== undefined) {
        (updates as any)[field] = req.body[field];
      }
    });

    const updated = await Vendor.findOneAndUpdate(
      { user: userId },
      updates,
      { new: true }
    ).lean();
    if (!updated) {
       res.status(404).json({ message: "Vendor not found" });
       return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// ربط متجر بالتاجر (attach)
export const attachStoreToVendor = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id as string;
    const { storeId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
       res.status(400).json({ message: "Invalid storeId" });
       return;
    }

    // تأكد أن المتجر موجود
    const store = await DeliveryStore.findById(storeId);
    if (!store) {
       res.status(404).json({ message: "Store not found" });
       return;
    }

    // تأكد أنه لم يُربط مسبقًا
    let vendor = await Vendor.findOne({ user: userId });
    if (vendor) {
       res
        .status(400)
        .json({ message: "You already have a store assigned" });
        return;
    }

    vendor = new Vendor({ user: userId, store: storeId });
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
export const listVendors = async (req: Request, res: Response) => {
  try {
    const vendors = await Vendor.find()
      .populate("store", "name address")   // يحضر اسم المتجر وعنوانه
      .select("-password");                // يحذف حقل الباسورد من النتيجة
    res.json(vendors);
  } catch (err: any) {
    console.error("listVendors error:", err);
    res.status(500).json({ message: "حدث خطأ أثناء جلب التجار" });
  }
};
export const getMerchantReports = async (req: Request, res: Response) => {
  try {
    const vendorId = req.user!.id;
    // جلب الـ Vendor لنعرف المتجر
const vendor = await Vendor.findOne({ user: vendorId })
  .lean<IVendor | null>();

    if (!vendor) {
       res.status(404).json({ message: "Vendor not found" });
       return;
    }
    const storeId = new mongoose.Types.ObjectId(vendor.store);

    // تحديد الفترة
    const period = req.query.period === "monthly" ? "monthly" : "daily";
    const now = new Date();
    let start: Date;
    if (period === "monthly") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(now.setHours(0,0,0,0));
    }

    // تجميع المبيعات وعدد الطلبات
    const result = await Order.aggregate([
      { $match: {
          "subOrders.store": storeId,
          status: "delivered",
          deliveredAt: { $gte: start }
      }},
      { $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          ordersCount:  { $sum: 1 }
      }}
    ]);

    const { totalRevenue = 0, ordersCount = 0 } = result[0] || {};
    res.json({ period, since: start, totalRevenue, ordersCount });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
// إزالة ربط المتجر (detach)
export const detachStoreFromVendor = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id as string;
    const { storeId } = req.params;
    const vendor = await Vendor.findOne({ user: userId, store: storeId });
    if (!vendor) {
       res
        .status(404)
        .json({ message: "No matching vendor-store relationship" });
        
    }
    await vendor.deleteOne();
    res.json({ message: "Store detached successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
