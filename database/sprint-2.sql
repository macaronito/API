-- SPRINT 2: "As a learner, I would like to book a lesson with a tutor."

-- // TUTOR LANGUAGES //
CREATE TABLE `TutorLanguages` (
  `TutorLanguageTutorID` int(5) NOT NULL,
  `TutorLanguageLanguageID` int(3) NOT NULL,
  PRIMARY KEY (`TutorLanguageTutorID`, `TutorLanguageLanguageID`),
  KEY `FKTutorLanguageLanguageID` (`TutorLanguageLanguageID`),
  CONSTRAINT `FKTutorLanguageTutorID` FOREIGN KEY (`TutorLanguageTutorID`) REFERENCES `Users` (`UserID`),
  CONSTRAINT `FKTutorLanguageLanguageID` FOREIGN KEY (`TutorLanguageLanguageID`) REFERENCES `Languages` (`LanguageID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `TutorLanguages` (`TutorLanguageTutorID`, `TutorLanguageLanguageID`)
SELECT DISTINCT `LessonTutorID`, `LessonLanguageID` FROM `Lessons`;

-- (Tutors w/ no lessons yet)
INSERT INTO `TutorLanguages` (`TutorLanguageTutorID`, `TutorLanguageLanguageID`) VALUES
(41, 8), (47, 9), (51, 10), (52, 11), (53, 11), (54, 11), (57, 12), (58, 12);

-- // TUTOR APPROVAL //
ALTER TABLE `Users` ADD `UserApproved` tinyint(1) NOT NULL DEFAULT 0;

UPDATE `Users` SET `UserApproved` = 1
WHERE `UserType` = 'Tutor' AND `UserID` IN (SELECT DISTINCT `LessonTutorID` FROM `Lessons`);

-- // 30/60 MINUTE LESSONS //
UPDATE `Lessons` SET `LessonDuration` = 30 WHERE `LessonDuration` = 25;
UPDATE `Lessons` SET `LessonDuration` = 60 WHERE `LessonDuration` = 50;

ALTER TABLE `Lessons` ADD CONSTRAINT `CKLessonDuration` CHECK (`LessonDuration` IN (30, 60));