import { conformTutor } from '../utils/conformance.js';
import { readApprovedTutor } from '../models/users-model.js';
import { readTutorLanguages } from '../models/tutors-model.js';

export const getTutorLanguages = async (req, res) => {
  const { tutorId } = req;
  try {
    const tutor = await readApprovedTutor(tutorId);
    if (!tutor) {
      return res.status(404).json({ message: `No approved tutor found with ID ${tutorId}.` });
    }
    const languages = await readTutorLanguages(tutorId);
    return res.status(200).json(conformTutor(tutor, languages));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: 'Could not retrieve the tutor. Please try again later.' });
  }
};
