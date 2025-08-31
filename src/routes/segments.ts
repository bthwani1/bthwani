// routes/segments.ts
import express from 'express';

import Segment from '../models/Segment';
import SegmentMember from '../models/SegmentMember';
import { buildUserPipeline } from '../services/segments/pipeline';
import mongoose from 'mongoose';
import { z } from 'zod';
import { writeLimiter } from '../middleware/security';
import { validate } from '../middleware/validate';

// Schema للقواعد
const ruleSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('last_order_days'), op: z.enum(['>','<','>=','<=','=',]), value: z.number().min(0) }),
  z.object({ field: z.literal('orders_count'),   op: z.enum(['>','<','>=','<=','=',]), value: z.number().min(0) }),
  z.object({ field: z.literal('utm.campaign'),   op: z.enum(['==','!=']), value: z.string().min(1) }),
  z.object({ field: z.literal('utm.source'),     op: z.enum(['==','!=']), value: z.string().min(1) }),
  z.object({ field: z.literal('city'),           op: z.enum(['==','!=']), value: z.string().min(1) }),
]);

const segmentBody = z.object({
  name: z.string().min(2),
  dynamic: z.boolean().default(true),
  rules: z.array(ruleSchema).min(1),
});

const previewBody = z.object({ rules: z.array(ruleSchema).min(1) });

const router = express.Router();

// POST /segments/preview — يرجّع العدد وعينة IDs
router.post('/segments/preview', writeLimiter, validate({ body: previewBody }), async (req, res, next) => {
  try {
    const pipeline = buildUserPipeline(req.body.rules);
    const coll = mongoose.connection.collection('users');
    const cursor = coll.aggregate(pipeline);
    const ids: string[] = [];
    let count = 0;
    for await (const doc of cursor) {
      count++;
      if (ids.length < 50) ids.push(String(doc._id));
    }
     res.json({ count, sampleIds: ids });
     return;
  } catch (e) { next(e); }
});

// POST /segments/sync — يحفظ الشريحة ويحدّث أعضاءها لو static
router.post('/segments/sync', writeLimiter, validate({ body: segmentBody }), async (req, res, next) => {
  try {
    const { name, rules, dynamic } = req.body;
    const seg = await Segment.findOneAndUpdate(
      { name },
      { $set: { name, rules, dynamic, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    let synced = 0;
    if (!dynamic) {
      const pipeline = buildUserPipeline(rules);
      const coll = mongoose.connection.collection('users');
      const cursor = coll.aggregate(pipeline);

      // امسح الأعضاء القدامى وأعد بناءهم
      await SegmentMember.deleteMany({ segmentId: seg._id });
      const bulk = SegmentMember.collection.initializeUnorderedBulkOp();
      for await (const doc of cursor) {
        bulk.insert({ segmentId: seg._id, userId: String(doc._id), addedAt: new Date() });
        synced++;
      }
      if (synced) await bulk.execute();
      await Segment.updateOne({ _id: seg._id }, { $set: { lastSyncedAt: new Date() } });
    }

    res.json({ segmentId: seg._id, dynamic, synced });
  } catch (e) { next(e); }
});

export default router;
