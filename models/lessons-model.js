import database from '../database.js';
import { DURATIONS, addMinutes } from '../utils/validation.js';

const LONGEST_LESSON = Math.max(...DURATIONS);
const ACTIVE = `LessonStatus IN ('Confirmed', 'Rescheduled')`;

// Every lesson read from the database has the same columns, so they are written once.
const SELECT_LESSONS = `
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
  INNER JOIN Languages ON Lessons.LessonLanguageID = Languages.LanguageID`;

// A lesson is upcoming until it ends. The first time check lets MySQL use the
// (LessonLearnerID, LessonStartTime) index, because no lesson is longer than LONGEST_LESSON.
const UPCOMING = `
  Lessons.LessonLearnerID = ?
  AND Lessons.${ACTIVE}
  AND Lessons.LessonStartTime > UTC_TIMESTAMP() - INTERVAL ${LONGEST_LESSON} MINUTE
  AND DATE_ADD(Lessons.LessonStartTime, INTERVAL Lessons.LessonDuration MINUTE) > UTC_TIMESTAMP()`;

export const countUpcomingLessons = async (learnerId) => {
  const sql = `SELECT COUNT(*) AS UpcomingLessonCount FROM Lessons WHERE ${UPCOMING}`;
  const [rows] = await database.query(sql, [learnerId]);
  return rows[0].UpcomingLessonCount;
};

export const readUpcomingLessons = async (learnerId, limit, offset) => {
  const sql = `${SELECT_LESSONS} WHERE ${UPCOMING} ORDER BY Lessons.LessonStartTime LIMIT ? OFFSET ?`;
  const [rows] = await database.query(sql, [learnerId, limit, offset]);
  return rows;
};

export const readLesson = async (lessonId) => {
  const sql = `${SELECT_LESSONS} WHERE Lessons.LessonID = ?`;
  const [rows] = await database.query(sql, [lessonId]);
  return rows[0];
};

// Two lessons overlap if each one starts before the other one ends.
export const countClashingLessons = async (connection, booking) => {
  const sql = `
    SELECT COUNT(*) AS ClashCount FROM Lessons
    WHERE (LessonTutorID = ? OR LessonLearnerID = ?)
      AND ${ACTIVE}
      AND LessonStartTime < ?
      AND LessonStartTime > ?
      AND DATE_ADD(LessonStartTime, INTERVAL LessonDuration MINUTE) > ?`;
  const [rows] = await connection.query(sql, [
    booking.tutorId,
    booking.learnerId,
    addMinutes(booking.startTime, booking.durationMinutes),
    addMinutes(booking.startTime, -LONGEST_LESSON),
    booking.startTime,
  ]);
  return rows[0].ClashCount;
};

export const insertLesson = async (connection, booking) => {
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
