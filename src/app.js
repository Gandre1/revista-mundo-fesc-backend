const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const authorRoutes = require('./routes/authorRoutes');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/files', fileRoutes);

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  try {
    await db.query('SELECT 1');
    console.log('Conexión a la base de datos establecida correctamente.');
  } catch (error) {
    console.error('ERROR: No se pudo conectar a la base de datos.');
  }
});