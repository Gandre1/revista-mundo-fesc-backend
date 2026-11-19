const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const emailService = require('../services/emailService');
const isValidPassword = require('../utils/passwordValidation');

const passwordResetMessage = 'Si el correo está asociado a una cuenta, recibirás instrucciones para restablecer tu contraseña.';

const getPasswordResetUrl = (token) => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error('Debe configurar FRONTEND_URL para enviar enlaces de restablecimiento.');
  }

  const resetUrl = new URL('/reset-password', frontendUrl);
  if (!['http:', 'https:'].includes(resetUrl.protocol)) {
    throw new Error('FRONTEND_URL debe usar HTTP o HTTPS.');
  }
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
};

// REGISTRO DE USUARIOS
exports.register = async (req, res) => {
  const { nombre, apellidos, email, password, afiliacion, pais, orcid } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios.' });
  }

  try {
    // Verificar si el correo ya existe
    const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
    }

    // Cifrar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generar UUID único para la llave primaria
    const userId = globalThis.crypto ? globalThis.crypto.randomUUID() : Date.now().toString();

    // Insertar usuario en la base de datos
    await db.query(
      `INSERT INTO users (id, nombre, apellidos, email, password, afiliacion, pais, orcid) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, nombre, apellidos || null, email, hashedPassword, afiliacion || null, pais || null, orcid || null]
    );

    res.status(201).json({ message: 'Usuario registrado exitosamente.', userId });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// INICIO DE SESIÓN (LOGIN)
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son obligatorios.' });
  }

  try {
    // Buscar usuario por correo
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Credenciales inválidas (usuario no encontrado).' });
    }

    const user = users[0];
    if (!user.password) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    // Verificar la contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas (contraseña incorrecta).' });
    }

    // Generar Token JWT
    const payload = { id: user.id, role: user.role, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    res.json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.forgotPassword = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    return res.status(400).json({ message: 'El correo electrónico es obligatorio.' });
  }

  try {
    const [users] = await db.query(
      'SELECT id, nombre, email FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length > 0) {
      const user = users[0];
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
        [user.id, tokenHash, expiresAt]
      );

      try {
        await emailService.sendPasswordResetEmail(
          user.email,
          user.nombre,
          getPasswordResetUrl(token)
        );
      } catch (error) {
        await db.query(
          'DELETE FROM password_reset_tokens WHERE user_id = ? AND token_hash = ?',
          [user.id, tokenHash]
        );
        throw error;
      }
    }

    return res.json({ message: passwordResetMessage });
  } catch (error) {
    console.error('Error al solicitar restablecimiento de contraseña:', error);
    return res.status(500).json({ message: 'No fue posible procesar la solicitud de restablecimiento.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) ||
      typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'El token y la nueva contraseña son obligatorios.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({
      message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
    });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [resetTokens] = await db.query(
      `SELECT user_id
       FROM password_reset_tokens
       WHERE token_hash = ? AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    if (resetTokens.length === 0) {
      return res.status(400).json({ message: 'El token de restablecimiento no es válido o ha expirado.' });
    }

    const userId = resetTokens[0].user_id;
    const [consumedToken] = await db.query(
      `DELETE FROM password_reset_tokens
       WHERE token_hash = ? AND expires_at > NOW()`,
      [tokenHash]
    );
    if (consumedToken.affectedRows !== 1) {
      return res.status(400).json({ message: 'El token de restablecimiento no es válido o ha expirado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);

    return res.json({ message: 'Contraseña restablecida correctamente.' });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    return res.status(500).json({ message: 'No fue posible restablecer la contraseña.' });
  }
};