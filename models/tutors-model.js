import database from '../database.js';

export const readTutorLanguages = async (tutorId) => {
  const sql = `
    SELECT Languages.LanguageID, Languages.LanguageName
    FROM TutorLanguages
    INNER JOIN Languages ON TutorLanguages.TutorLanguageLanguageID = Languages.LanguageID
    WHERE TutorLanguages.TutorLanguageTutorID = ?
    ORDER BY Languages.LanguageName`;
  const [rows] = await database.query(sql, [tutorId]);
  return rows;
};

export const tutorTeachesLanguage = async (tutorId, languageId, db = database) => {
  const sql = `
    SELECT COUNT(*) AS LanguageCount FROM TutorLanguages
    WHERE TutorLanguageTutorID = ? AND TutorLanguageLanguageID = ?`;
  const [rows] = await db.query(sql, [tutorId, languageId]);
  return rows[0].LanguageCount > 0;
};
