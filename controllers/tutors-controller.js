import database from '../database.js';

// ---------- VALIDATION ----------

const validateRequest = (req) => {
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return { error: 'The tutor ID must be a whole number of 1 or more.' };
  }
  return { tutorId: Number(req.params.id) };
};

// ---------- DB ACCESS ----------

const readTutor = async (tutorId) => {
  const sql = `
    SELECT UserID, UserFirstName, UserLastName, UserTimeZone FROM Users
    WHERE UserID = ? AND UserType = 'Tutor' AND UserApproved = 1`;
  const [rows] = await database.query(sql, [tutorId]);
  return rows[0];
};

const readTutorLanguages = async (tutorId) => {
  const sql = `
    SELECT Languages.LanguageID, Languages.LanguageName
    FROM TutorLanguages
    INNER JOIN Languages ON TutorLanguages.TutorLanguageLanguageID = Languages.LanguageID
    WHERE TutorLanguages.TutorLanguageTutorID = ?
    ORDER BY Languages.LanguageName`;
  const [rows] = await database.query(sql, [tutorId]);
  return rows;
};

// ---------- CONFORMANCE ----------

const conformTutor = (tutor, languages) => ({
  tutorId: tutor.UserID,
  firstName: tutor.UserFirstName,
  lastName: tutor.UserLastName,
  timeZone: tutor.UserTimeZone,
  languages: languages.map((language) => ({
    languageId: language.LanguageID,
    name: language.LanguageName,
  })),
});

// ---------- CONTROLLER ----------

export const getTutorLanguages = async (req, res) => {
  const request = validateRequest(req);
  if (request.error) return res.status(400).json({ message: request.error });

  try {
    const tutor = await readTutor(request.tutorId);
    if (!tutor) {
      return res
        .status(404)
        .json({ message: `No approved tutor found with ID ${request.tutorId}.` });
    }
    const languages = await readTutorLanguages(request.tutorId);
    return res.status(200).json(conformTutor(tutor, languages));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: 'Could not retrieve the tutor. Please try again later.' });
  }
};
