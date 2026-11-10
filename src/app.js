const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const db = require('./config/db');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const authorRoutes = require('./routes/authorRoutes');
const fileRoutes = require('./routes/fileRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const emailTemplateRoutes = require('./routes/emailTemplateRoutes');
const issueRoutes = require('./routes/issueRoutes');
const publicRoutes = require('./routes/publicRoutes');
const exportRoutes = require('./routes/exportRoutes');
const issueController = require('./controllers/issueController');
const emailService = require('./services/emailService');

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
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', exportRoutes);

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'El archivo supera el limite permitido.' });
    }
    return res.status(400).json({ message: 'No fue posible procesar el archivo enviado.' });
  }
  if (error?.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ message: error.message });
  }
  return next(error);
});

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

const ensureEmailTemplatesTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS email_templates (
      id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      template_key varchar(100) NOT NULL,
      name varchar(150) NOT NULL,
      subject varchar(255) NOT NULL,
      body_html longtext NOT NULL,
      variables_disponibles JSON NOT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY email_templates_key_unique (template_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
};

const normalizeSubmissionStatuses = async () => {
  await db.query(
    `UPDATE submissions
     SET estado = 'publicado'
     WHERE LOWER(TRIM(estado)) IN ('aceptado', 'accepted', 'aprobado', 'approved')`
  );
  await db.query(
    `UPDATE submissions
     SET estado = 'en_revision'
     WHERE LOWER(TRIM(estado)) IN ('evaluado', 'evaluated')`
  );
};

const startServer = async () => {
  try {
    await db.query('SELECT 1');
    await ensureIssueCoverColumn();
    await ensureEmailTemplatesTable();
    await emailService.ensureDefaultTemplates();
    await normalizeSubmissionStatuses();
    console.log('Conexión a la base de datos establecida correctamente.');
    await issueController.promoteScheduledIssues();
    setInterval(() => {
      issueController.promoteScheduledIssues();
    }, 60 * 1000).unref();
  } catch (error) {
    console.error('ERROR: No se pudo preparar la conexión o la migración de la base de datos.', error);
  }
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
};

startServer();