import database from '../database.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DURATIONS = [30, 60];

// ---------- VALIDATION ----------

const toWholeNumber = (value, min) => {
  if (!/^\d+$/.test(String(value))) return null;
  const number = Number(value);
  return number >= min ? number : null;
};

const validateRequest = (req) => {
  const learnerId = toWholeNumber(req.params.id, 1);
  if (learnerId === null) return { error: 'The learner ID must be a whole number of 1 or more.' };

  const page = req.query.page === undefined ? 1 : toWholeNumber(req.query.page, 1);
  if (page === null) return { error: 'page must be a whole number of 1 or more.' };

  const limit = req.query.limit === undefined ? DEFAULT_LIMIT : toWholeNumber(req.query.limit, 1);
  if (limit === null || limit > MAX_LIMIT) {
    return { error: `limit must be a whole number from 1 to ${MAX_LIMIT}.` };
  }

  return { learnerId, page, limit };
};

// A start time must be a full date and time with a time zone, e.g. 2026-11-20T18:00:00Z
const toStartTime = (value) => {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  // Reject dates that do not exist, e.g. 30 February (JavaScript would move it to March)
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validateBooking = (req) => {
  const learnerId = toWholeNumber(req.params.id, 1);
  if (learnerId === null) return { error: 'The learner ID must be a whole number of 1 or more.' };

  const body = req.body || {};

  const tutorId = toWholeNumber(body.tutorId, 1);
  if (tutorId === null) return { error: 'tutorId must be a whole number of 1 or more.' };

  const languageId = toWholeNumber(body.languageId, 1);
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
    learnerId,
    tutorId,
    languageId,
    level: body.level,
    startTime,
    durationMinutes: body.durationMinutes,
  };
};

// ---------- DB ACCESS ----------

const UPCOMING_CONDITION = `
  Lessons.LessonLearnerID = ?
  AND Lessons.LessonStatus IN ('Confirmed', 'Rescheduled')
  AND DATE_ADD(Lessons.LessonStartTime, INTERVAL Lessons.LessonDuration MINUTE) > UTC_TIMESTAMP()`;

const readLearner = async (learnerId) => {
  const sql = 'SELECT UserID, UserType, UserTimeZone FROM Users WHERE UserID = ?';
  const [rows] = await database.query(sql, [learnerId]);
  return rows[0];
};

const countUpcomingLessons = async (learnerId) => {
  const sql = `SELECT COUNT(*) AS UpcomingLessonCount FROM Lessons WHERE ${UPCOMING_CONDITION}`;
  const [rows] = await database.query(sql, [learnerId]);
  return rows[0].UpcomingLessonCount;
};

const readUpcomingLessons = async (learnerId, limit, offset) => {
  const sql = `
    SELECT Lessons.LessonID,
           Lessons.LessonStartTime,
           Lessons.LessonDuration,
           Languages.LanguageName,
           Lessons.LessonLevel,
           Lessons.LessonStatus,
           Tutors.UserFirstName AS TutorFirstName,
           Tutors.UserLastName AS TutorLastName
    FROM Lessons
    INNER JOIN Users AS Tutors ON Lessons.LessonTutorID = Tutors.UserID
    INNER JOIN Languages ON Lessons.LessonLanguageID = Languages.LanguageID
    WHERE ${UPCOMING_CONDITION}
    ORDER BY Lessons.LessonStartTime
    LIMIT ? OFFSET ?`;
  const [rows] = await database.query(sql, [learnerId, limit, offset]);
  return rows;
};

const readTutor = async (connection, tutorId) => {
  const sql = 'SELECT UserID, UserType, UserApproved FROM Users WHERE UserID = ?';
  const [rows] = await connection.query(sql, [tutorId]);
  return rows[0];
};

const tutorTeachesLanguage = async (connection, tutorId, languageId) => {
  const sql = `
    SELECT COUNT(*) AS LanguageCount FROM TutorLanguages
    WHERE TutorLanguageTutorID = ? AND TutorLanguageLanguageID = ?`;
  const [rows] = await connection.query(sql, [tutorId, languageId]);
  return rows[0].LanguageCount > 0;
};

// Locks the learner's and tutor's rows until the transaction ends, so two bookings
// for the same person cannot both pass the clash check at the same time.
const lockUsers = async (connection, learnerId, tutorId) => {
  const sql = 'SELECT UserID FROM Users WHERE UserID IN (?, ?) FOR UPDATE';
  await connection.query(sql, [learnerId, tutorId]);
};

// Two lessons overlap if each one starts before the other one ends.
const countClashingLessons = async (connection, booking, endTime) => {
  const sql = `
    SELECT COUNT(*) AS ClashCount FROM Lessons
    WHERE (LessonTutorID = ? OR LessonLearnerID = ?)
      AND LessonStatus IN ('Confirmed', 'Rescheduled')
      AND LessonStartTime < ?
      AND DATE_ADD(LessonStartTime, INTERVAL LessonDuration MINUTE) > ?`;
  const [rows] = await connection.query(sql, [
    booking.tutorId,
    booking.learnerId,
    endTime,
    booking.startTime,
  ]);
  return rows[0].ClashCount;
};

const insertLesson = async (connection, booking) => {
  const sql = `
    INSERT INTO Lessons (LessonLearnerID, LessonTutorID, LessonLanguageID, LessonLevel,
                         LessonStartTime, LessonDuration, LessonStatus)
    VALUES (?, ?, ?, ?, ?, ?, 'Confirmed')`;
  const [result] = await connection.query(sql, [
    booking.learnerId,
    booking.tutorId,
    booking.languageId,
    booking.level,
    booking.startTime,
    booking.durationMinutes,
  ]);
  return result.insertId;
};

const readLesson = async (lessonId) => {
  const sql = `
    SELECT Lessons.LessonID,
           Lessons.LessonStartTime,
           Lessons.LessonDuration,
           Languages.LanguageName,
           Lessons.LessonLevel,
           Lessons.LessonStatus,
           Tutors.UserFirstName AS TutorFirstName,
           Tutors.UserLastName AS TutorLastName
    FROM Lessons
    INNER JOIN Users AS Tutors ON Lessons.LessonTutorID = Tutors.UserID
    INNER JOIN Languages ON Lessons.LessonLanguageID = Languages.LanguageID
    WHERE Lessons.LessonID = ?`;
  const [rows] = await database.query(sql, [lessonId]);
  return rows[0];
};

// ---------- CONFORMANCE ----------

const formatLocalTime = (date, timeZone) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

const conformLesson = (record, timeZone) => {
  const start = record.LessonStartTime;
  const end = new Date(start.getTime() + record.LessonDuration * 60 * 1000);
  return {
    lessonId: record.LessonID,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    localStartTime: formatLocalTime(start, timeZone),
    durationMinutes: record.LessonDuration,
    language: record.LanguageName,
    level: record.LessonLevel,
    status: record.LessonStatus,
    tutor: { firstName: record.TutorFirstName, lastName: record.TutorLastName },
  };
};

// ---------- CONTROLLER ----------

export const getUpcomingLessons = async (req, res) => {
  const request = validateRequest(req);
  if (request.error) return res.status(400).json({ message: request.error });
  const { learnerId, page, limit } = request;

  try {
    const learner = await readLearner(learnerId);
    if (!learner || learner.UserType !== 'Learner') {
      return res.status(404).json({ message: `No learner found with ID ${learnerId}.` });
    }

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
// Returns a message for anything that stops the booking, or null if it can go ahead.
const checkBooking = async (connection, booking) => {
  const tutor = await readTutor(connection, booking.tutorId);
  if (!tutor || tutor.UserType !== 'Tutor' || !tutor.UserApproved) {
    return `No approved tutor found with ID ${booking.tutorId}.`;
  }
  if (!(await tutorTeachesLanguage(connection, booking.tutorId, booking.languageId))) {
    return 'This tutor does not teach that language.';
  }
  return null;
};

export const bookLesson = async (req, res) => {
  const booking = validateBooking(req);
  if (booking.error) return res.status(400).json({ message: booking.error });

  const endTime = new Date(booking.startTime.getTime() + booking.durationMinutes * 60 * 1000);
  let connection;

  try {
    connection = await database.getConnection();

    const learner = await readLearner(booking.learnerId);
    if (!learner || learner.UserType !== 'Learner') {
      return res.status(404).json({ message: `No learner found with ID ${booking.learnerId}.` });
    }

    const problem = await checkBooking(connection, booking);
    if (problem) return res.status(400).json({ message: problem });

    await connection.beginTransaction();
    await lockUsers(connection, booking.learnerId, booking.tutorId);

    if ((await countClashingLessons(connection, booking, endTime)) > 0) {
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
