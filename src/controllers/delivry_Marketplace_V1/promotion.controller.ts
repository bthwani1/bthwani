// controllers/delivery_Marketplace_V1/promotion.controller.ts
import { Request, Response } from "express";
import Promotion from "../../models/delivry_Marketplace_V1/Promotion";

const now = new Date();

// Create
export const createPromotion = async (req: Request, res: Response) => {
  try {
    const promo = new Promotion(req.body);
    await promo.save();
    res.status(201).json(promo);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// Get all (للعميل وغير المسؤول)
export const getActivePromotions = async (req: Request, res: Response) => {
  try {
    const { placement, city, channel } = req.query as any;

    const now = new Date();
    const filter: any = {
      isActive: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] },
      ],
    };

    if (placement) filter.placements = placement;
    if (city) filter.$or = [{ cities: { $size: 0 } }, { cities: city }];
    if (channel) filter.$and.push({ $or: [{ channels: { $size: 0 } }, { channels: channel }] });

    const promos = await Promotion.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .populate("product store category");

    res.json(promos);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
// Get by ID
export const getPromotionById = async (req: Request, res: Response) => {
  try {
    const promo = await Promotion.findById(req.params.id);
    if (!promo) {
res.status(404).json({ message: "Promotion not found" });
        return;
    } 
    res.json(promo);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// Update
export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(promo);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// Delete
export const deletePromotion = async (req: Request, res: Response) => {
  try {
    await Promotion.findByIdAndDelete(req.params.id);
    res.json({ message: "Promotion deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
