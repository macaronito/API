import express from 'express';
import cors from 'cors';
import learnersRouter from './routes/learners-router.js';
import tutorsRouter from './routes/tutors-router.js';

const app = express();
app.use(cors());
app.use(express.json());

// ----- ENDPOINTS
app.use('/api/learners', learnersRouter);
app.use('/api/tutors', tutorsRouter);

// ----- ANY OTHER ROUTE
app.use((req, res) =>
  res.status(404).json({ message: `No endpoint at ${req.method} ${req.originalUrl}` }),
);

// ----- START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LanguageLink API running on http://localhost:${PORT}`));
