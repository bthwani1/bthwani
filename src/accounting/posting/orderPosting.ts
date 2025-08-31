// accounting/posting/orderPosting.ts
import { Types } from "mongoose";
import DeliveryOrder from "../../models/delivry_Marketplace_V1/Order";
import DeliveryStore from "../../models/delivry_Marketplace_V1/DeliveryStore";
import { ensureGLForDriver, ensureGLForStore } from "../services/ensureEntityGL";
import { byCode, createAndPostEntry } from "../services/postingHelpers"; // helpers: get account by code, createEntry+post

export async function postOrderDelivered(orderId: string) {
    const order = await DeliveryOrder.findById(orderId).lean();
    if (!order) throw new Error("Order not found");

    // اجمع صافي كل متجر (لو عندك أكثر من متجر في الطلب)
    const merchantMap = new Map<string, number>(); // storeId -> net
    for (const so of order.subOrders) {
        const subTotal = so.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        // عمولة المتجر لهذه السلة = subTotal * rate (محسوبة لديك ضمن companyShare ككل)
        // سنوزع merchantNet بالتناسب لو أحببت. الآن نفترض merchantNet = subTotal - عمولة جزء هذا المتجر.
        merchantMap.set(String(so.store), (merchantMap.get(String(so.store)) || 0) + subTotal);
    }
    // نسبة توزيع companyShare على المتاجر (بالتناسب مع قيمة كل subTotal)
    const totalSub = [...merchantMap.values()].reduce((a, b) => a + b, 0) || 1;
    const lines: any[] = [];

    // تحصيل العميل
    if (order.paymentMethod === "card") {
        lines.push({ account: await byCode("1131"), debit: order.price, desc: `تحصيل بوابة - طلب ${order._id}` });
    } else if (order.paymentMethod === "wallet") {
        lines.push({ account: await byCode("2122"), debit: order.walletUsed, desc: `تسوية محفظة - طلب ${order._id}` });
    } else if (order.paymentMethod === "mixed") {
        lines.push({ account: await byCode("2122"), debit: order.walletUsed, desc: `تسوية محفظة - طلب ${order._id}` });
        const driverAR = Math.max(order.cashDue - order.deliveryFee, 0);
        if (driverAR > 0) {
            // اختر سائق من الساب أوردر (أو order.driver)
            const anyDriver = order.subOrders.find(s => s.driver)?.driver || order.driver;
            if (anyDriver) {
                const { ar } = await ensureGLForDriver(String(anyDriver));
                lines.push({ account: ar, debit: driverAR, desc: `تحصيل COD مع السائق - طلب ${order._id}` });
            }
        }
    }

    // عمولة المنصة
    if (order.companyShare > 0) {
        lines.push({ account: await byCode("4201"), credit: order.companyShare, desc: `عمولة المنصة - طلب ${order._id}` });
    }

    // مستحقات التجار (وزّع صافي المبيعات)
    for (const [storeId, subTotal] of merchantMap) {
        const portion = subTotal / totalSub;
        const storeCommissionPart = order.companyShare * portion;
        const merchantNet = subTotal - storeCommissionPart;

        const store = await DeliveryStore.findById(storeId).lean();
        const storeGL = store?.glPayableAccount || await ensureGLForStore(storeId);
        if (merchantNet > 0) {
            lines.push({ account: storeGL, credit: merchantNet, desc: `مستحق تاجر ${store?.name || storeId} - طلب ${order._id}` });
        }
    }

    // رسوم التوصيل:
    if (order.paymentMethod === "card" || order.paymentMethod === "wallet") {
        // سندفع للسائق لاحقًا
        if (order.deliveryFee > 0) {
            lines.push({ account: await byCode("2301"), credit: order.deliveryFee, desc: `مستحق سائق/مقاصة - طلب ${order._id}` });
        }
    }
    // في حالة COD والسائق أخذ الأجرة مباشرة: لا تسجّل شيء على 2301

    await createAndPostEntry({
        date: order.deliveredAt || new Date(),
        voucherType: "order",
        reference: String(order._id),
        description: `قيد طلب ${order._id}`,
        lines,
    });
}
