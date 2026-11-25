import { Router } from 'express';
import checkId from './check-id.js';
import { getTutorLanguages } from '../controllers/tutors-controller.js';

const router = Router();
router.param('id', checkId('tutor'));

router.get('/:id/languages', getTutorLanguages);

export default router;
