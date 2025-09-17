// services/promotion/pricing.service.ts
import Promotion, {
  IPromotion,
} from "../../models/delivry_Marketplace_V1/Promotion";
import { FilterQuery } from "mongoose";

type ValueType = "percentage" | "fixed";

export interface PricingContext {
  now?: Date;
  city?: string;
  channel?: "app" | "web";
  placement?: string; // لواجهة الاستدعاء (home_hero, category_feed,...)
}

export interface ProductLike {
  _id: any;
  price: number; // السعر الأساسي
  store?: any;
  categories?: any[];
}

export interface AppliedPromotion {
  promoId: string;
  title?: string;
  amount: number; // مقدار الخصم
  value?: number;
  valueType?: ValueType;
  target: "product" | "store" | "category";
}

const inDateWindow = (p: IPromotion, now: Date) => {
  const sOk = !p.startDate || p.startDate <= now;
  const eOk = !p.endDate || p.endDate >= now;
  return sOk && eOk;
};

export async function fetchActivePromotions(ctx: PricingContext = {}) {
  const now = ctx.now ?? new Date();
  const filter: FilterQuery<IPromotion> = {
    isActive: true,
    $and: [
      {
        $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }],
      },
      { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] },
    ],
  };

  if (ctx.placement) filter.placements = ctx.placement;
  // city
  if (ctx.city) {
    filter.$or = [{ cities: { $size: 0 } }, { cities: ctx.city }];
  }
  if (ctx.channel) {
    filter.$and?.push({
      $or: [{ channels: { $size: 0 } }, { channels: ctx.channel }],
    });
  }

  return Promotion.find(filter).lean<IPromotion[]>();
}

function discountAmount(
  base: number,
  value: number = 0,
  type: ValueType = "fixed",
  max?: number
) {
  let d = type === "percentage" ? (base * value) / 100 : value;
  if (max && d > max) d = max;
  if (d < 0) d = 0;
  return Math.min(d, base);
}

export function bestProductDiscountFor(
  promos: IPromotion[],
  product: ProductLike
): AppliedPromotion | null {
  let best: AppliedPromotion | null = null;

  for (const p of promos) {
    const targetsThis =
      (p.target === "product" && String(p.product) === String(product._id)) ||
      (p.target === "store" && String(p.store) === String(product.store)) ||
      (p.target === "category" &&
        product.categories?.some((c) => String(c) === String(p.category)));

    if (!targetsThis) continue;

    const amt = discountAmount(
      product.price,
      p.value ?? 0,
      p.valueType ?? "fixed",
      p.maxDiscountAmount ?? undefined
    );
    if (!best || amt > best.amount) {
      best = {
        promoId: String(p._id),
        title: p.title,
        amount: amt,
        value: p.value,
        valueType: p.valueType ?? "fixed",
        target: p.target,
      };
    }
  }
  return best;
}

export function applyPromotionToProduct(
  product: ProductLike,
  promos: IPromotion[]
) {
  const best = bestProductDiscountFor(promos, product);
  const originalPrice = product.price;
  const discount = best?.amount ?? 0;
  const finalPrice = Math.max(0, originalPrice - discount);

  return {
    originalPrice,
    finalPrice,
    discount,
    appliedPromotion: best,
  };
}
