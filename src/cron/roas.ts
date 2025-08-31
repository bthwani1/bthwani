// cron/roas.ts
import cron from 'node-cron';
import { computeRoasForDay } from '../services/analytics/roas';

export function registerRoasCron() {
  // 02:15 UTC كل يوم
  cron.schedule('15 2 * * *', async () => {
    try {
      const today = new Date();
      const yesterdayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()-1));
      await computeRoasForDay(yesterdayUTC);
    } catch (e) {
      console.error('ROAS cron failed', e);
    }
  });
}
