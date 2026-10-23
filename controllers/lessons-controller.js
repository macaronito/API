import database from '../database.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

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