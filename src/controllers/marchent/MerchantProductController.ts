import { Request, Response } from "express";
import MerchantProduct from "../../models/mckathi/MerchantProduct";
import ProductCatalog from "../../models/mckathi/ProductCatalog";
import StoreSection from "../../models/delivry_Marketplace_V1/StoreSection";
import {
  applyPromotionToProduct,
  fetchActivePromotions,
} from "../../services/promotion/pricing.service";

// --- جلب كل المنتجات (للمشرف/admin)
export const getAllMerchantProducts = async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    if (req.query.store) filter.store = req.query.store;
    if (req.query.section) filter.section = req.query.section;

    const city =
      (req.query.city as string) ||
      (req.headers["x-city"] as string) ||
      undefined;
    const channel: "app" | "web" = (req.query.channel as any) || "app";

    const products = await MerchantProduct.find(filter)
      .populate({
        path: "product",
        populate: { path: "attributes.attribute category" },
      })
      .populate("store")
      .populate("merchant")
      .populate("customAttributes.attribute")
      .populate("section")
      .lean();

    const promos = await fetchActivePromotions({ city, channel });

    const data = products.map((mp: any) => {
      const catalog = mp.product; // يحتوي category
      // Always return an array of category IDs
      let categories: any[] = [];
      if (catalog?.category) {
        if (Array.isArray(catalog.category)) {
          categories = catalog.category.map((cat: any) => cat._id || cat);
        } else {
          categories = [catalog.category._id || catalog.category];
        }
      }
      const priced = applyPromotionToProduct(
        {
          _id: mp._id,
          price: mp.price,
          store: mp.store?._id || mp.store,
          categories,
        },
        promos
      );
      return {
        ...mp,
        originalPrice: priced.originalPrice,
        price: priced.finalPrice,
        appliedPromotion: priced.appliedPromotion,
      };
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: "حدث خطأ", error: err.message || err });
  }
};

export const getMerchantProductsByMerchant = async (
  req: Request,
  res: Response
) => {
  try {
    const { merchantId } = req.params;
    const city =
      (req.query.city as string) ||
      (req.headers["x-city"] as string) ||
      undefined;
    const channel: "app" | "web" = (req.query.channel as any) || "app";

    const products = await MerchantProduct.find({ merchant: merchantId })
      .populate({
        path: "product",
        populate: { path: "attributes.attribute category" },
      })
      .populate("merchant")
      .populate("store")
      .populate("customAttributes.attribute")
      .lean();

    const promos = await fetchActivePromotions({ city, channel });

    const data = products.map((mp: any) => {
      const catalog = mp.product;
      let categories: any[] = [];
      if (catalog?.category) {
        if (Array.isArray(catalog.category)) {
          categories = catalog.category.map((cat: any) => cat._id || cat);
        } else {
          categories = [catalog.category._id || catalog.category];
        }
      }
      const priced = applyPromotionToProduct(
        {
          _id: mp._id,
          price: mp.price,
          store: mp.store?._id || mp.store,
          categories,
        },
        promos
      );
      return {
        ...mp,
        originalPrice: priced.originalPrice,
        price: priced.finalPrice,
        appliedPromotion: priced.appliedPromotion,
      };
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: "حدث خطأ", error: err.message || err });
  }
};

// --- جلب منتج تاجر مفرد
export const getMerchantProductById = async (req: Request, res: Response) => {
  try {
    const city =
      (req.query.city as string) ||
      (req.headers["x-city"] as string) ||
      undefined;
    const channel: "app" | "web" = (req.query.channel as any) || "app";

    const mp = await MerchantProduct.findById(req.params.id)
      .populate({
        path: "product",
        populate: { path: "attributes.attribute category" },
      })
      .populate("merchant")
      .populate("store")
      .populate("customAttributes.attribute")
      .lean();

    if (!mp) {
      res.status(404).json({ message: "المنتج غير موجود" });
      return;
    }

    const promos = await fetchActivePromotions({ city, channel });

    const catalog: any = mp.product;
let categories: any[] = [];
if (catalog?.category) {
  if (Array.isArray(catalog.category)) {
    categories = catalog.category.map((cat: any) => cat._id || cat);
  } else {
    categories = [ (catalog.category as any)._id || catalog.category ];
  }
}
 
    const priced = applyPromotionToProduct(
      {
        _id: mp._id,
        price: mp.price,
        store: mp.store?._id || mp.store,
        categories,
      },
      promos
    );

    res.json({
      ...mp,
      originalPrice: priced.originalPrice,
      price: priced.finalPrice,
      appliedPromotion: priced.appliedPromotion,
    });
  } catch (err: any) {
    res.status(500).json({ message: "حدث خطأ", error: err.message || err });
  }
};

// --- جلب منتجات تاجر حسب القسم/التصنيف
export const getMerchantProductsByCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const { merchantId, categoryId } = req.params;

    const city =
      (req.query.city as string) ||
      (req.headers["x-city"] as string) ||
      undefined;
    const channel: "app" | "web" = (req.query.channel as any) || "app";

    const products = await MerchantProduct.find({ merchant: merchantId })
      .populate({
        path: "product",
        match: { category: categoryId },
        populate: { path: "attributes.attribute category" },
      })
      .populate("merchant")
      .populate("store")
      .populate("customAttributes.attribute")
      .lean();

    const filtered = products.filter((p: any) => p.product !== null);

    const promos = await fetchActivePromotions({ city, channel });

    const data = filtered.map((mp: any) => {
      const catalog = mp.product;
      let categories: any[] = [];
      if (catalog?.category) {
        if (Array.isArray(catalog.category)) {
          categories = catalog.category.map((cat: any) => cat._id || cat);
        } else {
          categories = [catalog.category._id || catalog.category];
        }
      }
      const priced = applyPromotionToProduct(
        {
          _id: mp._id,
          price: mp.price,
          store: mp.store?._id || mp.store,
          categories,
        },
        promos
      );
      return {
        ...mp,
        originalPrice: priced.originalPrice,
        price: priced.finalPrice,
        appliedPromotion: priced.appliedPromotion,
      };
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: "حدث خطأ", error: err.message || err });
  }
};

// --- إضافة منتج تاجر
// --- إضافة منتج تاجر
export const addMerchantProduct = async (req: Request, res: Response) => {
  try {
    const {
      merchant,
      product,
      price,
      stock,
      isAvailable,
      customImage,
      customDescription,
      customAttributes,
      store,
      section,
    } = req.body;

    let sectionId = section;

    // ====== هنا المنطق الجديد ======
    if (!sectionId) {
      // جلب المنتج من الكاتالوج لمعرفة الكاتجوري
      const catalogProduct = await ProductCatalog.findById(product).populate(
        "category"
      );
      if (!catalogProduct) {
        res.status(400).json({ message: "المنتج غير موجود في الكاتالوج" });
        return;
      }
      // اسم القسم الداخلي يكون نفس اسم الكاتجوري أو id الكاتجوري
      let sectionName: string;
      if (
        catalogProduct.category &&
        typeof catalogProduct.category === "object" &&
        "name" in catalogProduct.category
      ) {
        sectionName = (catalogProduct.category as any).name;
      } else {
        res
          .status(400)
          .json({ message: "لا يوجد اسم فئة للمنتج في الكاتالوج" });
        return;
      }

      // ابحث عن section للمتجر بنفس الاسم
      let sec = await StoreSection.findOne({ name: sectionName, store });
      if (!sec) {
        // أنشئ section تلقائي
        sec = await StoreSection.create({
          name: sectionName,
          store,
          usageType: "grocery", // أو حسب الحاجة
        });
      }
      sectionId = sec._id;
    } else {
      // تحقق من صحة section والمتجر
      const sec = await StoreSection.findById(sectionId);
      if (!sec || sec.store.toString() !== store) {
        res
          .status(400)
          .json({ message: "فئة داخلية غير صالحة أو لا تتبع المتجر" });
        return;
      }
    }

    // تحقق أن المنتج في الكاتالوج موجود
    const productExists = await ProductCatalog.findById(product);
    if (!productExists) {
      res.status(400).json({ message: "المنتج غير موجود في الكاتالوج" });
      return;
    }

    // تحقق من تكرار المنتج لنفس التاجر (اختياري)
    const exists = await MerchantProduct.findOne({ merchant, product });
    if (exists) {
      res.status(400).json({ message: "هذا المنتج موجود مسبقًا للتاجر" });
      return;
    }

    const merchantProduct = new MerchantProduct({
      merchant,
      product,
      price,
      store,
      section: sectionId, // هنا دائمًا سترسل sectionId
      stock,
      isAvailable,
      customImage,
      customDescription,
      customAttributes,
    });

    await merchantProduct.save();
    res.status(201).json(merchantProduct);
  } catch (err) {
    res.status(500).json({ message: "حدث خطأ", error: err });
  }
};

// --- تعديل منتج تاجر
export const updateMerchantProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await MerchantProduct.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    )
      .populate({
        path: "product",
        populate: { path: "attributes.attribute category" },
      })
      .populate("merchant")
      .populate("customAttributes.attribute");

    if (!updated) {
      res.status(404).json({ message: "المنتج غير موجود" });
      return;
    }
    if (updateData.section) {
      const sec = await StoreSection.findById(updateData.section);
      if (!sec || sec.store.toString() !== updateData.store) {
        res
          .status(400)
          .json({ message: "فئة داخلية غير صالحة أو لا تتبع المتجر" });
        return;
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "حدث خطأ", error: err });
  }
};

// --- حذف منتج تاجر
export const deleteMerchantProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await MerchantProduct.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: "المنتج غير موجود" });
      return;
    }
    res.json({ message: "تم الحذف بنجاح" });
  } catch (err) {
    res.status(500).json({ message: "حدث خطأ", error: err });
  }
};
