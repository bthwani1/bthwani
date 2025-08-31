import { addJournalEntry, getJournal } from '../../controllers/er/journalBook.controller';
import { Router } from 'express';
const router = Router();
router.get('/', getJournal);
// router.post('/', addJournalEntry);
export default router;
