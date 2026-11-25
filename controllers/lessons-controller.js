import database from '../database.js';
import { LEVELS, DURATIONS, toWholeNumber, toStartTime } from '../utils/validation.js';
import { conformLesson } from '../utils/conformance.js';
import { readLearner, readApprovedTutor, lockUsers } from '../models/users-model.js';
import { tutorTeachesLanguage } from '../models/tutors-model.js';
import {
  countUpcomingLessons,
  readUpcomingLessons,
  readLesson,
  countClashingLessons,
  insertLesson,
} from '../models/lessons-model.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// ---------- VALIDATION ----------

const validatePaging = (query) => {
  const page = query.page === undefined ? 1 : toWholeNumber(query.page);
  if (page === null) return { error: 'page must be a whole number of 1 or more.' };

  const limit = query.limit === undefined ? DEFAULT_LIMIT : toWholeNumber(query.limit);
  if (limit === null || limit > MAX_LIMIT) {
    return { error: `limit must be a whole number from 1 to ${MAX_LIMIT}.` };
  }
  return { page, limit };
};

const validateBooking = (body = {}) => {
  const tutorId = toWholeNumber(body.tutorId);
  if (tutorId === null) return { error: 'tutorId must be a whole number of 1 or more.' };

  const languageId = toWholeNumber(body.languageId);
  if (languageId === null) return { error: 'languageId must be a whole number of 1 or more.' };

  if (!LEVELS.includes(body.level)) {
    return { error: `level must be one of ${LEVELS.join(', ')}.` };
  }

  const startTime = toStartTime(body.startTime);
  if (startTime === null) {
    return {
      error: 'startTime must be a date and time with a time zone, e.g. 2026-11-20T18:00:00Z.',
    };
  }
  if (startTime <= new Date()) return { error: 'startTime must be in the future.' };

  if (!DURATIONS.includes(body.durationMinutes)) {
    return { error: `durationMinutes must be ${DURATIONS.join(' or ')}.` };
  }

  return {
    tutorId,
    languageId,
    level: body.level,
    startTime,
    durationMinutes: body.durationMinutes,
  };
};

// ---------- CONTROLLERS ----------

export const getUpcomingLessons = async (req, res) => {
  const { learnerId } = req;
  const paging = validatePaging(req.query);
  if (paging.error) return res.status(400).json({ message: paging.error });
  const { page, limit } = paging;

  try {
    const learner = await readLearner(learnerId);
    if (!learner)
      return res.status(404).json({ message: `No learner found with ID ${learnerId}.` });

    const totalLessons = await countUpcomingLessons(learnerId);
    const records = await readUpcomingLessons(learnerId, limit, (page - 1) * limit);

    return res.status(200).json({
      learnerId,
      timeZone: learner.UserTimeZone,
      page,
      limit,
      totalLessons,
      totalPages: Math.ceil(totalLessons / limit),
      lessons: records.map((record) => conformLesson(record, learner.UserTimeZone)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not retrieve lessons. Please try again later.' });
  }
};

export const bookLesson = async (req, res) => {
  const booking = validateBooking(req.body);
  if (booking.error) return res.status(400).json({ message: booking.error });
  booking.learnerId = req.learnerId;

  let connection;
  try {
    const learner = await readLearner(booking.learnerId);
    if (!learner) {
      return res.status(404).json({ message: `No learner found with ID ${booking.learnerId}.` });
    }
    if (!(await readApprovedTutor(booking.tutorId))) {
      return res
        .status(404)
        .json({ message: `No approved tutor found with ID ${booking.tutorId}.` });
    }
    if (!(await tutorTeachesLanguage(booking.tutorId, booking.languageId))) {
      return res.status(400).json({ message: 'This tutor does not teach that language.' });
    }

    connection = await database.getConnection();
    await connection.beginTransaction();
    await lockUsers(connection, [booking.learnerId, booking.tutorId]);

    if ((await countClashingLessons(connection, booking)) > 0) {
      await connection.rollback();
      return res
        .status(409)
        .json({ message: 'The tutor or the learner already has a lesson at this time.' });
    }

    const lessonId = await insertLesson(connection, booking);
    await connection.commit();

    const record = await readLesson(lessonId);
    return res.status(201).json(conformLesson(record, learner.UserTimeZone));
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error(error);
    return res.status(500).json({ message: 'Could not book the lesson. Please try again later.' });
  } finally {
    if (connection) connection.release();
  }
};
