const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const authorRoutes = require('./routes/authorRoutes');
const fileRoutes = require('./routes/fileRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const issueRoutes = require('./routes/issueRoutes');
const publicRoutes = require('./routes/publicRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Role', 'Bypass-Tunnel-Reminder'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', exportRoutes);

const ensureIssueCoverColumn = async () => {
  const [columns] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'issues'
       AND COLUMN_NAME = 'cover_url'`
  );
  if (columns.length === 0) {
    await db.query(
      `ALTER TABLE issues
       ADD COLUMN cover_url varchar(2048) DEFAULT NULL AFTER description`
    );
    console.log('Migración automática aplicada: issues.cover_url.');
  }
};

const startServer = async () => {
  try {
    await db.query('SELECT 1');
    await ensureIssueCoverColumn();
    console.log('Conexión a la base de datos establecida correctamente.');
  } catch (error) {
    console.error('ERROR: No se pudo preparar la conexión o la migración de la base de datos.', error);
  }
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
};

startServer();