// Turns database rows into the JSON the frontend receives.

const formatLocalTime = (date, timeZone) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

export const conformLesson = (record, timeZone) => {
  const start = record.LessonStartTime;
  const end = new Date(start.getTime() + record.LessonDuration * 60 * 1000);
  return {
    lessonId: record.LessonID,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    localStartTime: formatLocalTime(start, timeZone),
    durationMinutes: record.LessonDuration,
    language: record.LanguageName,
    level: record.LessonLevel,
    status: record.LessonStatus,
    tutorFirstName: record.TutorFirstName,
    tutorLastName: record.TutorLastName,
  };
};

export const conformTutor = (tutor, languages) => ({
  tutorId: tutor.UserID,
  firstName: tutor.UserFirstName,
  lastName: tutor.UserLastName,
  timeZone: tutor.UserTimeZone,
  languages: languages.map((language) => ({
    languageId: language.LanguageID,
    name: language.LanguageName,
  })),
});
