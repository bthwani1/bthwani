// cron/adspend.ts
import cron from 'node-cron';
import { importGoogleCSV, importMetaCSV, importTikTokCSV } from '../services/adspend/importers';

// شغّل 02:00 كل يوم (UTC)
export function registerAdSpendCron() {
  cron.schedule('0 2 * * *', async () => {
    try {
      // إن كانت لديك مصادر CSV على التخزين (S3/Bunny/…)
      if (process.env.AD_CSV_GOOGLE_PATH) await importGoogleCSV(process.env.AD_CSV_GOOGLE_PATH);
      if (process.env.AD_CSV_META_PATH)   await importMetaCSV(process.env.AD_CSV_META_PATH);
      if (process.env.AD_CSV_TIKTOK_PATH) await importTikTokCSV(process.env.AD_CSV_TIKTOK_PATH);
      // لاحقًا: استبدلها باستدعاء APIs الرسمية
    } catch (e) {
      console.error('AdSpend cron failed', e);
    }
  });
}
