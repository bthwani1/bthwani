// bootstrap/indexes.ts
import MarketingEvent from '../models/MarketingEvent';
import AdSpend from '../models/AdSpend';
import PushToken from '../models/PushToken';
// import User from '../models/User';
// import Order from '../models/Order';

export async function initIndexesAndValidate() {
  const models = [
    MarketingEvent,
    AdSpend,
    PushToken,
    // User, Order
  ];

  for (const m of models) {
    // يتأكد من تطابق الفهارس مع تعريف الـSchema (يبني/يحذف الزائد)
    await m.syncIndexes();
    // فحص سريع للصحة (إن أردت)
    // await m.validate(); // هذه للدكيومنت، وليست للموديل كله —
    // بدلاً منها، اعتمد على اختبارات الوحدة للـschemas.
  }
  // لو أردت ضمان بناء الفهارس قبل استقبال الترافيك:
  // await Promise.all(models.map(m => m.createIndexes()));
}
