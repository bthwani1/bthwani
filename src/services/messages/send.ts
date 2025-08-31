// services/messaging/send.ts
import MessageMetric from '../../models/MessageMetric';
import PushToken from '../../models/PushToken';
import * as Expo from 'expo-server-sdk';

const expo = new Expo.Expo();

const WEEKLY_CAP = Number(process.env.MESSAGE_WEEKLY_CAP ?? 3); // حد رسائل/أسبوع/مستخدم
const CAP_WINDOW_MS = 7 * 86400000;

export async function filterByCap(userIds: string[]) {
  const since = new Date(Date.now() - CAP_WINDOW_MS);
  const agg = await MessageMetric.aggregate([
    { $match: { userId: { $in: userIds }, ts: { $gte: since }, event: 'sent' } },
    { $group: { _id: '$userId', c: { $sum: 1 } } }
  ]);
  const counts = new Map(agg.map(a => [String(a._id), a.c]));
  return userIds.filter(u => (counts.get(u) ?? 0) < WEEKLY_CAP);
}

export async function sendPushToUsers(userIds: string[], title: string|undefined, body: string, messageId: any) {
  const tokens = await PushToken.find({ userId: { $in: userIds } }).lean();
  const messages = tokens
    .filter(t => Expo.Expo.isExpoPushToken(t.token))
    .map(t => ({ to: t.token, sound: 'default', title, body }));
  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  for (const ch of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(ch);
    sent += tickets.length;
  }
  // سجل الأحداث
  if (sent) {
    const docs = userIds.map(uid => ({ userId: uid, messageId, channel: 'push', event: 'sent', ts: new Date() }));
    await MessageMetric.insertMany(docs, { ordered: false });
  }
  return sent;
}
