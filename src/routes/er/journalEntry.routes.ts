// routes/er/journalEntry.routes.ts
import { RequestHandler, Router } from 'express';
import { createEntry, listEntries, getEntry, updateEntry, postEntry } from '../../controllers/er/journalEntry.controller';
import { peekNextVoucherNo } from '../../models/er/counter.model';
const router = Router();
const nextNoHandler: RequestHandler = async (_req, res, next) => {
    try {
      const voucherNo = await peekNextVoucherNo();
      res.json({ voucherNo });        // لا تعمل return هنا
    } catch (err) {
      next(err);
    }
  };
  
router.get('/', listEntries);
router.get('/next-no', nextNoHandler);
router.get('/:voucherNo', getEntry);
router.post('/', createEntry);
router.put('/:voucherNo', updateEntry);
router.post('/:voucherNo/post', postEntry);

export default router;
