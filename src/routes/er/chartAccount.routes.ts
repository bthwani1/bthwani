import { Router } from 'express';
import {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  getAccountTree,
  getAccountsAnalysis,
  deleteAccountAndChildren,
  listAccounts,
} from '../../controllers/er/chartAccount.controller';

const router = Router();
router.get('/', getAccounts);
router.get('/tree', getAccountTree);
router.get('/analysis', getAccountsAnalysis);
router.get('/list', listAccounts);
router.get('/:id', getAccount);
router.post('/', createAccount);
router.patch('/:id', updateAccount);
router.delete('/:id', deleteAccountAndChildren);
export default router;
