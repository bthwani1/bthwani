// routes/messages.ts
import express from 'express';
import { z, ZodTypeAny } from 'zod';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/security';
import SegmentMember from '../models/SegmentMember';
import Message from '../models/Message';
import { filterByCap, sendPushToUsers } from '../services/messages/filterAndSend';
import mongoose from 'mongoose';

const router = express.Router();

const sendSchema = z.object({
  channel: z.enum(['push','sms','inapp']),
  title: z.string().optional(),
  body: z.string().min(1),
  // أحدهما مطلوب:
  segmentId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  scheduleAt: z.string().datetime().optional(), // ISO
});

// POST /messages/send — فوري (إن لم يُمرر scheduleAt)
router.post("/api/v1/messages/send",
  validate({ body: z.object({
    channel: z.enum(["push","sms","inapp"]),
    title: z.string().optional(),
    body: z.string().min(1),
    segmentId: z.string().optional(),
    userIds: z.array(z.string()).optional(),
    scheduleAt: z.string().datetime().optional()
  }) as ZodTypeAny }),
  async (req, res, next) => {
    try {
      const { channel, title, body, segmentId, userIds=[], scheduleAt } = req.body as any;
      let recipients: string[] = userIds;
      if (segmentId) {
        const rows = await SegmentMember.find({ segmentId }).select("userId").lean();
        recipients = rows.map(r => r.userId);
      }
      // جدولة مستقبلية (MVP: reject أو خزّن كـ"scheduled" لتشغيل كرون)
      if (scheduleAt) {
        const m = await Message.create({ channel, title, body, segmentId, userIds: recipients, scheduleAt, status:"scheduled" });
        res.json({ ok:true, message:m });
        return;
      }

      // إرسال فوري
      const filtered = await filterByCap(recipients, channel);
      const m = await Message.create({ channel, title, body, segmentId, userIds: filtered, status:"sending" });
      await sendPushToUsers(filtered, title, body, m._id);
      res.json({ ok:true, sent: filtered.length, messageId: m._id });
      return;
    } catch(e){ next(e); }
  }
);


// POST /messages/schedule — فقط إنشاء رسالة مجدولة
router.post('/messages/schedule', writeLimiter, validate({ body: sendSchema.extend({ scheduleAt: z.string().datetime() }) }), async (req, res, next) => {
  try {
    const { channel, title, body, segmentId, userIds, scheduleAt } = req.body;
    const msg = await Message.create({
      channel, title, body,
      segmentId: segmentId ? new mongoose.Types.ObjectId(segmentId) : undefined,
      userIds,
      scheduleAt: new Date(scheduleAt),
      status: 'scheduled',
      createdBy: (req as any).user?.id
    });
    res.json({ scheduled: true, messageId: msg._id });
    return;
  } catch (e) { next(e); }
});

export default router;
