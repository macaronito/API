import mysql from 'mysql2/promise';

const database = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'languagelink',
  // Lesson times are stored in UTC, so read DATETIME columns as UTC.
  timezone: 'Z',
  connectionLimit: 10,
});

export default database;