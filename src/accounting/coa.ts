// src/accounting/coa.ts
export const COA = {
    // أصول
    CASH_MAIN: "1101",
    CASH_BRANCH: "1102",
    DRIVER_CASH_FLOAT: "1103",       // عهدة نقدية – الكباتن (اختياري للاستخدام التشغيلي)
    BANKS: "1111",
    EWALLETS: "1121",
    PG_HOLDING: "1131",              // بوابات دفع – أرصدة معلّقة
    AR_CUSTOMERS: "1201",
    AR_MERCHANT_FEES: "1203",        // ذمم التجّار (عمولات) إن احتجت أصولاً (غالباً لن تستخدم هنا)
    AR_DRIVERS_PARENT: "1211",       // ذمم السائقين (أصل – عهد)
    ADV_SUPPLIERS: "1213",
  
    // خصوم
    AP_SUPPLIERS: "2101",
    AP_MERCHANTS_PARENT: "2102",     // ذمم التجار (مستحقات لهم) ← الأب للتحليلي لكل متجر
    COD_CLEARING: "2103",
    ACCRUED_EXP: "2105",
    GATEWAY_PAYABLES: "2111",
    DEFERRED_REV: "2121",
    CUSTOMER_PREPAID: "2122",        // قسائم/محافظ مسبقة الدفع – التزام
    LOYALTY: "2131",
  
    // إيرادات
    REV_DELIV_RESTAURANTS: "4101",
    REV_DELIV_GROCERIES:  "4102",
    REV_CANCELLATION:     "4105",
    REV_MERCHANT_COMMISSION: "4201",
    REV_GATEWAY_COD_FEE:  "4204",
    REV_PREP_FEE:         "4205",
    CONTRA_DISCOUNTS:     "4444",
  
    // تكلفة مباشرة
    COGS_DRIVER_COMMISSIONS: "5101",
    COGS_GATEWAY_FEES:      "5103",
  } as const;
  