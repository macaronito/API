import express from 'express';
import cors from 'cors';
import { getUpcomingLessons, bookLesson } from './controllers/lessons-controller.js';
import { getTutorLanguages } from './controllers/tutors-controller.js';

const app = express();
app.use(cors());
app.use(express.json());

// ----- ENDPOINTS
app.get('/api/learners/:id/lessons/upcoming', getUpcomingLessons);
app.post('/api/learners/:id/lessons', bookLesson);
app.get('/api/tutors/:id/languages', getTutorLanguages);

// ----- ANY OTHER ROUTE
app.use((req, res) =>
  res.status(404).json({ message: `No endpoint at ${req.method} ${req.originalUrl}` }),
);

// ----- START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LanguageLink API running on http://localhost:${PORT}`));
