const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { crypto } = require('crypto');

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