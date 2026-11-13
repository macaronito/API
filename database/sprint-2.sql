-- ----- SPRINT 2: BOOK A LESSON
-- Run once on the languagelink database.

-- ----- TUTOR LANGUAGES
CREATE TABLE `TutorLanguages` (
  `TutorLanguageTutorID` int(5) NOT NULL,
  `TutorLanguageLanguageID` int(3) NOT NULL,
  PRIMARY KEY (`TutorLanguageTutorID`, `TutorLanguageLanguageID`),
  KEY `FKTutorLanguageLanguageID` (`TutorLanguageLanguageID`),
  CONSTRAINT `FKTutorLanguageTutorID` FOREIGN KEY (`TutorLanguageTutorID`) REFERENCES `Users` (`UserID`),
  CONSTRAINT `FKTutorLanguageLanguageID` FOREIGN KEY (`TutorLanguageLanguageID`) REFERENCES `Languages` (`LanguageID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tutors teach the languages of their lessons.
INSERT INTO `TutorLanguages` (`TutorLanguageTutorID`, `TutorLanguageLanguageID`)
SELECT DISTINCT `LessonTutorID`, `LessonLanguageID` FROM `Lessons`;

-- Tutors with no lessons yet.
INSERT INTO `TutorLanguages` (`TutorLanguageTutorID`, `TutorLanguageLanguageID`) VALUES
(41, 8), (47, 9), (51, 10), (52, 11), (53, 11), (54, 11), (57, 12), (58, 12);

-- ----- TUTOR APPROVAL
ALTER TABLE `Users` ADD `UserApproved` tinyint(1) NOT NULL DEFAULT 0;

-- Tutors with lessons are approved. The 8 without are still waiting.
UPDATE `Users` SET `UserApproved` = 1
WHERE `UserType` = 'Tutor' AND `UserID` IN (SELECT DISTINCT `LessonTutorID` FROM `Lessons`);

-- ----- LESSON LENGTHS
-- Lessons are 30 or 60 minutes.
UPDATE `Lessons` SET `LessonDuration` = 30 WHERE `LessonDuration` = 25;
UPDATE `Lessons` SET `LessonDuration` = 60 WHERE `LessonDuration` = 50;

ALTER TABLE `Lessons` ADD CONSTRAINT `CKLessonDuration` CHECK (`LessonDuration` IN (30, 60));
