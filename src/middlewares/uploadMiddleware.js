const multer = require('multer');
const path = require('path');

// Filtro para validar extensiones permitidas
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Formato de archivo no soportado. Solo se permiten archivos PDF, DOC y DOCX.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const createUploadMiddleware = (destination = 'uploads/', filenamePrefix) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${filenamePrefix || file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  });
};

const upload = createUploadMiddleware();
upload.createUploadMiddleware = createUploadMiddleware;

module.exports = upload;