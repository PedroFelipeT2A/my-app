const mysql = require('mysql2');

const pool = mysql.createPool({
  host: '104.251.209.68',
  port: 35689,
  user: 'admin',
  password: 'Adr1an@',
  database: 'db_SamCast',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();
