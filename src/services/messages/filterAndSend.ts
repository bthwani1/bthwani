import MessagingPrefs from '../../models/MessagingPrefs';
import MessageMetric from '../../models/MessageMetric';
import Message from '../../models/Message';

export async function filterByCap(userIds: string[], channel: "push"|"sms"|"inapp" = "push") {
  const prefs = await MessagingPrefs.find({ userId: { $in: userIds } }).lean();
  const since = new Date(Date.now() - 24*60*60*1000);
  const ok = new Set<string>();

  for (const u of userIds) {
    const p = prefs.find(x => x.userId === u);
    // opt-in
    if (p && channel==="push" && p.pushOptIn===false) continue;
    if (p && channel==="sms"  && p.smsOptIn===false) continue;
    if (p && channel==="inapp"&& p.inappOptIn===false) continue;
    // cap اليومي
    const cnt = await MessageMetric.countDocuments({ userId: u, channel, event:"sent", ts:{ $gte: since } });
    const dailyCap = p?.caps?.daily ?? 1;
    if (cnt >= dailyCap) continue;
    // (MVP) تجاهل quietHours أو عالجها لاحقًا بحسب TZ
    ok.add(u);
  }
  return Array.from(ok);
}

// Stub للإرسال الفعلي (Expo/FCM أو In-App)
export async function sendPushToUsers(userIds: string[], title: string|undefined, body: string, messageId: any) {
  const now = new Date();
  const docs = userIds.map(u => ({ userId:u, messageId, channel:"push", event:"sent", ts:now }));
  if (docs.length) await MessageMetric.insertMany(docs, { ordered:false });
  await Message.updateOne({ _id: messageId }, { $set: { status:"sent", sentAt: now } });
}
