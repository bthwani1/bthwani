import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import Order from "../../models/delivry_Marketplace_V1/Order";
import Driver from "../../models/Driver_app/driver";    // ← هذا الاستيراد مطلوب
import { ensureGLForDriver } from "../../accounting/services/ensureEntityGL";

export const createDriver = async (req: Request, res: Response) => {
  try {
    const {
      fullName, phone, email, password, role, vehicleType,
      isFemaleDriver, driverType,
      residenceLocation: { address, governorate, city, lat, lng }
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    // 1) إنشاء السائق
    const driver = await Driver.create({
      fullName,
      phone,
      email,
      password: hashedPassword,
      role,
      vehicleType,
      isFemaleDriver,
      driverType,
      isVerified: true,
      residenceLocation: { address, governorate, city, lat, lng },
      // location geo default موجود في السكيمة
    });

    // 2) إنشاء/ضمان الحسابات التحليلية وربطها (1211-x و 1601/2161-x)
    const { ar, deposit } = await ensureGLForDriver(driver._id.toString(), {
      driverName: fullName,
      driverCodeSuffix: driver._id.toString().slice(-6), // اختياري لشكل الكود
    });

    // 3) حدّث السائق لو ما كانت موجودة
    const patch: any = {};
    if (!driver.glReceivableAccount) patch.glReceivableAccount = ar;
    if (!driver.glDepositAccount && deposit) patch.glDepositAccount = deposit;

    if (Object.keys(patch).length) {
      await Driver.findByIdAndUpdate(driver._id, patch, { new: true });
      Object.assign(driver, patch);
    }

    res.status(201).json(driver);
  } catch (error: any) {
    res.status(500).json({ message: "Error creating driver", error: error?.message || error });
  }
};
export const searchDrivers = async (req: Request, res: Response) => {
  const q = (req.query.q as string) || "";
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 50);
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const drivers = await Driver.find({
    $or: [{ fullName: regex }, { phone: { $regex: q, $options: "i" } }],
  })
    .select("_id fullName phone")
    .limit(limit)
    .lean();
  res.json(drivers);
};
// تبديل نوع السائق (primary ↔ joker) مع ضبط نافذة الجوكر
export const setJokerStatus = async (req: Request, res: Response) => {
  const { driverType, jokerFrom, jokerTo } = req.body;
  const driver = await Driver.findById(req.params.id);
  if (!driver) {
     res.status(404).json({ message: "Driver not found" });
     return;
  }

  // عندما يكون joker نعين نافذة، وإلا نحذفها
  driver.driverType = driverType;
  if (driverType === "joker") {
    driver.jokerFrom = new Date(jokerFrom);
    driver.jokerTo   = new Date(jokerTo);
  } else {
    driver.jokerFrom = undefined;
    driver.jokerTo   = undefined;
  }

  await driver.save();
  res.json(driver);
};
export const toggleBan = async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await Driver.findById(id);
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }

  driver.isBanned = !driver.isBanned;
  await driver.save();

  res.json({
    message: `Driver is now ${driver.isBanned ? "banned" : "unbanned"}`,
  });
};
export const verifyDriver = async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await Driver.findByIdAndUpdate(
    id,
    { isVerified: true },
    { new: true }
  );
  res.json(driver);
};

export const listDrivers = async (req: Request, res: Response) => {
  const { role, city, isAvailable } = req.query;

  const filter: any = {};
  if (role) filter.role = role;
  if (city) filter.city = city;
  if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";

  const drivers = await Driver.find(filter).select("-password");
  res.json(drivers);
};

export const resetPassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const hashed = await bcrypt.hash(newPassword, 10);
  const driver = await Driver.findByIdAndUpdate(id, { password: hashed });

  res.json({ message: "Password reset successfully" });
};

export const updateWallet = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, operation } = req.body; // operation: 'credit' | 'debit'

  const driver = await Driver.findById(id);
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }
  if (!["credit", "debit"].includes(operation)) {
    res.status(400).json({ message: "Invalid operation" });
    return;
  }

  if (!amount || amount <= 0) {
    res.status(400).json({ message: "Invalid amount" });
    return;
  }

  if (!driver.wallet)
    driver.wallet = {
      balance: 0,
      earnings: 0,
      lastUpdated: new Date(),
    };

  driver.wallet.balance += operation === "credit" ? amount : -amount;
  await driver.save();

  res.json({ message: "Wallet updated", balance: driver.wallet.balance });
};

export const assignDriver = async (req: Request, res: Response) => {
  const { driverId, orderId } = req.body;
  const driver = await Driver.findById(driverId);
  if (!driver) {
    res.status(404).json({ message: "Driver not found" });
    return;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  order.driver     = driver.id;
  order.status = "preparing";
  order.assignedAt = new Date();

  await order.save();

  res.json({ message: "Driver assigned", order });
};
