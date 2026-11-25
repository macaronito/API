import { Router } from 'express';
import checkId from './check-id.js';
import { getUpcomingLessons, bookLesson } from '../controllers/lessons-controller.js';

const router = Router();
router.param('id', checkId('learner'));

router.get('/:id/lessons/upcoming', getUpcomingLessons);
router.post('/:id/lessons', bookLesson);

export default router;
