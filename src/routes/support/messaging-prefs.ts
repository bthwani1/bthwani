// routes/messaging-prefs.ts
import { Router } from "express";
import { z } from "zod";
import { validate2 } from "../../middleware/validate";
import MessagingPrefs from "../../models/support/MessagingPrefs";
const r = Router();

// GET /messaging-prefs/me
r.get("/me", async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const prefs =
    (await MessagingPrefs.findOne({ userId })) ||
    (await MessagingPrefs.create({ userId }));
  res.json(prefs);
});

// PATCH /messaging-prefs/me
const PatchSchema = z.object({
  body: z.object({
    channels: z
      .object({
        inApp: z.boolean().optional(),
        push: z.boolean().optional(),
        sms: z.boolean().optional(),
        email: z.boolean().optional(),
      })
      .optional(),
    quietHours: z
      .object({
        start: z.string().optional(),
        end: z.string().optional(),
        tz: z.string().optional(),
      })
      .optional(),
    caps: z.object({ perDay: z.number().int().min(0).optional() }).optional(),
  }),
});
r.patch("/me", validate2(PatchSchema), async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const prefs = await MessagingPrefs.findOneAndUpdate(
    { userId },
    { $set: req.body },
    { new: true, upsert: true }
  );
  res.json(prefs);
});

export default r;
