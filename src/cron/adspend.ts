// cron/adspend.ts
import cron from 'node-cron';
import { importCSV } from '../services/adspend/importers';

// شغّل 02:00 كل يوم (UTC)
export function registerAdSpendCron() {
  cron.schedule('0 2 * * *', async () => {
    try {
      // إن كانت لديك مصادر CSV على التخزين (S3/Bunny/…)
      if (process.env.AD_CSV_PATH) await importCSV(process.env.AD_CSV_PATH, "google");
      // لاحقًا: استبدلها باستدعاء APIs الرسمية
    } catch (e) {
      console.error('AdSpend cron failed', e);
    }
  });
}
