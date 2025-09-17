import { getDistance } from "geolib";
import UtilityPricing from "../models/delivry_Marketplace_V1/UtilityPricing";
import PricingStrategy from "../models/delivry_Marketplace_V1/PricingStrategy";
import { calculateDeliveryPrice } from "./deliveryPricing";

type WaterSizeKey = "small" | "medium" | "large";

export async function priceUtility(params: {
  city: string;
  kind: "gas" | "water";
  variant: string; // gas: "20L" | water: "small|medium|large"
  quantity: number; // water يسمح 0.5
}) {
  const cfg = await UtilityPricing.findOne({
    city: params.city,
    isActive: true,
  }).lean();
  if (!cfg) throw new Error("لم يتم ضبط تسعير الخدمات لهذه المدينة");

  if (params.kind === "gas") {
    if (!cfg.gas?.enabled)
      throw new Error("خدمة الغاز غير مفعّلة في هذه المدينة");
    const cyl = Number(cfg.gas.cylinderSizeLiters || 20);
    const requested = Number((params.variant || "").replace("L", "")) || cyl;
    if (requested !== cyl) {
      throw new Error(`المقاس المدعوم حاليًا ${cyl}L`);
    }
    const minQty = cfg.gas.minQty ?? 1;
    const qty = Number(params.quantity);
    if (!Number.isInteger(qty) || qty < minQty) {
      throw new Error(`الكمية يجب أن تكون عددًا صحيحًا ≥ ${minQty}`);
    }
    const unitPrice = cfg.gas.pricePerCylinder;
    const subtotal = unitPrice * qty;
    return {
      unitPrice,
      subtotal,
      cylinderSizeLiters: cyl,
      tankerCapacityLiters: undefined,
    };
  }

  // water
  if (!cfg.water?.enabled) throw new Error("خدمة وايت الماء غير مفعّلة");
  const key = params.variant as WaterSizeKey;
  const size = cfg.water.sizes.find((s) => s.key === key);
  if (!size) throw new Error("حجم الوايت غير مدعوم");

  let unitPrice = size.pricePerTanker;
  let qty = Number(params.quantity);

  if (qty === 0.5) {
    if (!cfg.water.allowHalf) throw new Error("طلب نصف وايت غير مسموح");
    switch (cfg.water.halfPricingPolicy) {
      case "linear":
        unitPrice = unitPrice * (cfg.water.halfLinearFactor ?? 0.5);
        break;
      case "multiplier":
        unitPrice = unitPrice * (cfg.water.halfMultiplier ?? 0.6);
        break;
      case "fixed":
        unitPrice = cfg.water.halfFixedAmount ?? Math.ceil(unitPrice * 0.6);
        break;
    }
    qty = 1; // نعامل النصف كوحدة تسعير خاصة
  }

  if (!(qty > 0)) throw new Error("الكمية غير صالحة");

  const subtotal = unitPrice * qty;
  return {
    unitPrice,
    subtotal,
    cylinderSizeLiters: undefined,
    tankerCapacityLiters: size.capacityLiters,
  };
}

export async function feeUtility(params: {
  city: string;
  kind: "gas" | "water";
  destination: { lat: number; lng: number };
}) {
  const cfg = await UtilityPricing.findOne({
    city: params.city,
    isActive: true,
  }).lean();
  if (!cfg) throw new Error("لا توجد إعدادات مدينة");

  // سياسة خاصّة لكل نوع
  const policy =
    params.kind === "gas"
      ? cfg.gas?.deliveryOverride?.policy
      : cfg.water?.deliveryOverride?.policy;

  // flat
  const flat =
    params.kind === "gas"
      ? cfg.gas?.deliveryOverride?.flatFee
      : cfg.water?.deliveryOverride?.flatFee;

  // أصل جغرافي (إن وجد)
  const origin = params.kind === "gas" ? cfg.origins?.gas : cfg.origins?.water;

  if (policy === "flat" && typeof flat === "number") {
    return Math.max(0, Math.ceil(flat));
  }

  // strategy: نحتاج إستراتيجية عامة + مسافة (لو مافي origin نحسب كـ 0 → basePrice)
  const strategy = await PricingStrategy.findOne({}).lean();
  if (!strategy) throw new Error("استراتيجية التسعير غير مكوَّنة");

  let distanceKm = 0;
  if (origin?.lat && origin?.lng) {
    distanceKm =
      getDistance(
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: params.destination.lat, longitude: params.destination.lng }
      ) / 1000;
  }

  return Math.ceil(calculateDeliveryPrice(distanceKm, strategy));
}
