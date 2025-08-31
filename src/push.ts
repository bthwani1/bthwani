import express from 'express';
import PushToken from './models/PushToken';
const r = express.Router();
r.post('/users/push-token', async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  } 
  const { token, device } = req.body;
  await PushToken.updateOne({ token }, { userId, token, device, updatedAt: new Date() }, { upsert:true });
  res.json({ ok: true });
});

export default r;
