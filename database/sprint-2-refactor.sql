-- SPRINT 2 REFACTORING

-- // INDEXES FOR LESSON TIMES //
-- The upcoming lessons list and the clash check both look up a learner's or tutor's lessons by start time.
ALTER TABLE `Lessons`
  ADD KEY `IXLessonLearnerStart` (`LessonLearnerID`, `LessonStartTime`),
  ADD KEY `IXLessonTutorStart` (`LessonTutorID`, `LessonStartTime`);

-- // ALLOWED VALUES //
ALTER TABLE `Lessons` ADD CONSTRAINT `CKLessonLevel` CHECK (`LessonLevel` IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
ALTER TABLE `Lessons` ADD CONSTRAINT `CKLessonStatus` CHECK (`LessonStatus` IN ('Confirmed', 'Rescheduled', 'Cancelled', 'Completed'));

-- // NO DUPLICATE LANGUAGES //
ALTER TABLE `Languages` ADD UNIQUE KEY `UQLanguageName` (`LanguageName`);
