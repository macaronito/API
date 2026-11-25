import database from '../database.js';

// db can be the pool or a connection inside a transaction.

export const readLearner = async (learnerId, db = database) => {
  const sql = `
    SELECT UserID, UserTimeZone FROM Users
    WHERE UserID = ? AND UserType = 'Learner'`;
  const [rows] = await db.query(sql, [learnerId]);
  return rows[0];
};

export const readApprovedTutor = async (tutorId, db = database) => {
  const sql = `
    SELECT UserID, UserFirstName, UserLastName, UserTimeZone FROM Users
    WHERE UserID = ? AND UserType = 'Tutor' AND UserApproved = 1`;
  const [rows] = await db.query(sql, [tutorId]);
  return rows[0];
};

// Locks the learner's and tutor's rows until the transaction ends, so two bookings
// for the same person cannot both pass the clash check at the same time.
export const lockUsers = async (connection, userIds) => {
  const sql = 'SELECT UserID FROM Users WHERE UserID IN (?) FOR UPDATE';
  await connection.query(sql, [userIds]);
};
