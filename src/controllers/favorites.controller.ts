import { Request, Response } from "express";
import { Types } from "mongoose";
import Favorite, { FavoriteType } from "../models/Favorite";
import { User } from "../models/user"; 
import DeliveryStore from "../models/delivry_Marketplace_V1/DeliveryStore";
import DeliveryProduct from "../models/delivry_Marketplace_V1/DeliveryProduct";

// ------ Helpers ------
const isValidObjectId = (v: any) => typeof v === "string" && Types.ObjectId.isValid(v);
const toObjectId = (v: string, field = "id") => {
  if (!isValidObjectId(v)) throw new Error(`Invalid ${field}`);
  return new Types.ObjectId(v);
};

function normalizeItemType(v: any): FavoriteType {
    const t = String(v ?? "").toLowerCase().trim();
    if (t === "product") return "product";
    if (["restaurant", "grocery", "store", "merchant"].includes(t)) return "restaurant";
    throw new Error("Invalid itemType");
  }
  

/** يحوّل Firebase UID إلى User._id (ObjectId). يقرأ من verifyFirebase: req.user.id */
async function getUserMongoId(req: Request) {
    const cached = (req as any).userMongoId;
    if (cached && Types.ObjectId.isValid(String(cached))) return new Types.ObjectId(String(cached));
    const uid = (req as any)?.user?.id || (req as any)?.user?.uid;
    if (!uid) throw new Error("Unauthorized: missing uid");
    if (Types.ObjectId.isValid(uid)) {
      const objId = new Types.ObjectId(uid);
      (req as any).userMongoId = objId;
      return objId;
    }
    const userDoc = await User.findOne({ firebaseUID: uid }).select("_id").lean();
    if (!userDoc?._id) throw new Error("User not found for provided uid");
    const objId = new Types.ObjectId(String(userDoc._id));
    (req as any).userMongoId = objId;
    return objId;
  }

// ------ Controllers ------

// GET /api/v1/favorites?type=product|restaurant
export async function listFavorites(req: Request, res: Response) {
    try {
      const userId = await getUserMongoId(req);
      const typeParam = req.query.type as any | undefined;
  
      const q: any = { user: userId };
      if (typeParam) q.itemType = normalizeItemType(typeParam);
  
      const favs = await Favorite.find(q).lean();
  
      console.log("[favorites:list] userId =", userId.toString());
      console.log("[favorites:list] count =", favs.length);
  
      // ✅ backfill للّقطات المفقودة (العناصر القديمة)
      const backfilled = await Promise.all(
        favs.map(async (f) => {
          if (f?.itemSnapshot && Object.keys(f.itemSnapshot).length) return f;
  
          try {
            if (f.itemType === "restaurant") {
              const s = await DeliveryStore.findById(f.item).select("name logo image rating").lean();
              if (s) f.itemSnapshot = { title: s.name, image: s.logo || s.image, rating: s.rating };
            } else {
              const p = await DeliveryProduct.findById(f.item).select("name image price rating").lean();
              if (p) f.itemSnapshot = { title: p.name, image: p.image, price: p.price, rating: (p as any).rating };
            }
          } catch {
            // تجاهل أي خطأ في التعبئة
          }
          return f;
        })
      );
  
      // دعم رد مسطّح للفرونت إن حبيت
      if ((req.query.flat as string) === "1") {
        const flat = backfilled.map((f) => ({
          _id: String(f._id ?? ""),
          itemId: String(f.item ?? ""),
          itemType: f.itemType as FavoriteType,
          userId: f.user ? String(f.user) : undefined,
          title: f.itemSnapshot?.title,
          image: f.itemSnapshot?.image,
          price: typeof f.itemSnapshot?.price === "number" ? f.itemSnapshot.price : undefined,
          rating: typeof f.itemSnapshot?.rating === "number" ? f.itemSnapshot.rating : undefined,
          createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : undefined,
        }));
         res.json(flat); // ⬅️ مهم: return
         return
      }
  
      res.json(backfilled); // ⬅️ مهم: return
      return
    } catch (e: any) {
      console.error("[favorites:list] ", e?.message || e);
      if (!res.headersSent) {
        res.status(400).json({ message: e?.message || "Failed to list favorites" });
        return
      }
      // لو الرد أُرسل، لا تحاول إرسال ثانيًا.
    }
  }

// POST /api/v1/favorites   body: { itemId, itemType, itemSnapshot? }
export async function addFavorite(req: Request, res: Response) {
  try {
    const userId = await getUserMongoId(req);
    const { itemId, itemSnapshot } = req.body as {
      itemId: string;
      itemType: FavoriteType | string;
      itemSnapshot?: { title?: string; image?: string; price?: number; rating?: number };
    };
    const itemType = normalizeItemType((req.body as any).itemType);

    if (!itemId) throw new Error("itemId and itemType are required");
    const item = toObjectId(itemId, "itemId");

    let snapshot = itemSnapshot;
    if (!snapshot) {
      if (itemType === "restaurant") {
        const s = await DeliveryStore.findById(item).select("name logo image rating").lean();
        if (s) snapshot = { title: s.name, image: s.logo || s.image, rating: s.rating as any };
      } else {
        const p = await DeliveryProduct.findById(item).select("name image price rating").lean();
        if (p) snapshot = { title: p.name, image: p.image, price: p.price, rating: (p as any).rating };
      }
    }

    const fav = await Favorite.findOneAndUpdate(
      { user: userId, item, itemType },
      { $setOnInsert: { user: userId, item, itemType }, ...(snapshot ? { $set: { itemSnapshot: snapshot } } : {}) },
      { upsert: true, new: true }
    ).lean();

    res.status(201).json(fav);
  } catch (e: any) {
    console.error("[favorites:add] ", e?.message || e);
    res.status(400).json({ message: e?.message || "Failed to add favorite" });
  }
}

// DELETE /api/v1/favorites/:itemType/:itemId
export async function removeFavorite(req: Request, res: Response) {
  try {
    const userId = await getUserMongoId(req);
    const itemType = normalizeItemType(req.params.itemType);
    const item = toObjectId(req.params.itemId, "itemId");

    const del = await Favorite.findOneAndDelete({ user: userId, item, itemType }).lean();
    if (!del) {
      res.status(404).json({ message: "Favorite not found" });
      return
    }

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[favorites:remove] ", e?.message || e);
    res.status(400).json({ message: e?.message || "Failed to remove favorite" });
  }
}

// GET /api/v1/favorites/exists/:itemType/:itemId
export async function existsFavorite(req: Request, res: Response) {
  try {
    const userId = await getUserMongoId(req);
    const itemType = normalizeItemType(req.params.itemType);
    const item = toObjectId(req.params.itemId, "itemId");

    const exists = await Favorite.exists({ user: userId, item, itemType });
    res.json({ exists: !!exists }); // ← حافظ على اسم المفتاح "exists"
  } catch (e: any) {
    console.error("[favorites:exists] ", e?.message || e);
    res.status(400).json({ message: e?.message || "Failed to check favorite" });
  }
}

// GET /api/v1/favorites/counts?type=product|restaurant&ids=a,b,c
export async function counts(req: Request, res: Response) {
  try {
    const userId = await getUserMongoId(req);
    const type = normalizeItemType(req.query.type);
    const idsParam = (req.query.ids as string) || "";

    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const objIds = ids.map((id) => toObjectId(id, "ids[]"));

    const favs = await Favorite.find({ user: userId, itemType: type, item: { $in: objIds } })
      .select("item")
      .lean();

    const map: Record<string, number> = {};
    ids.forEach((id) => (map[id] = 0));
    favs.forEach((f) => (map[String(f.item)] = 1));

    res.json(map);
  } catch (e: any) {
    console.error("[favorites:counts] ", e?.message || e);
    res.status(400).json({ message: e?.message || "Failed to get counts" });
  }
}
