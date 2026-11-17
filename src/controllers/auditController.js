const db = require('../config/db');

const MAX_LIMIT = 100;

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parsePositiveInteger(value, defaultValue, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.min(parsed, maximum) : null;
}

function getListingOptions(query, res) {
  const page = parsePositiveInteger(query.page, 1);
  const limit = parsePositiveInteger(query.limit, 20, MAX_LIMIT);
  if (page === null || limit === null) {
    res.status(400).json({ message: 'La paginación debe contener enteros positivos válidos.' });
    return null;
  }
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) {
    res.status(400).json({ message: 'La página solicitada está fuera del rango permitido.' });
    return null;
  }

  const filters = [];
  const values = [];
  const textFilters = [
    ['userId', 'user_id'],
    ['action', 'action'],
    ['target', 'target_model'],
  ];
  for (const [parameter, column] of textFilters) {
    const value = query[parameter];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim()) {
      res.status(400).json({ message: `El filtro ${parameter} no es válido.` });
      return null;
    }
    filters.push(`${column} = ?`);
    values.push(value.trim());
  }

  if (query.user !== undefined) {
    if (typeof query.user !== 'string' || !query.user.trim()) {
      res.status(400).json({ message: 'El filtro user no es válido.' });
      return null;
    }
    const userSearch = `%${query.user.trim()}%`;
    filters.push(`(users.nombre LIKE ?
      OR users.apellidos LIKE ?
      OR CONCAT_WS(' ', users.nombre, users.apellidos) LIKE ?
      OR users.email LIKE ?)`);
    values.push(userSearch, userSearch, userSearch, userSearch);
  }

  for (const parameter of ['startDate', 'endDate']) {
    const value = query[parameter];
    if (value !== undefined && !isValidDate(value)) {
      res.status(400).json({ message: 'Las fechas deben tener el formato AAAA-MM-DD y ser válidas.' });
      return null;
    }
  }
  if (query.startDate && query.endDate && query.startDate > query.endDate) {
    res.status(400).json({ message: 'La fecha de inicio no puede ser posterior a la fecha final.' });
    return null;
  }
  if (query.startDate) {
    filters.push('audit_logs.created_at >= ?');
    values.push(`${query.startDate} 00:00:00`);
  }
  if (query.endDate) {
    filters.push('audit_logs.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    values.push(`${query.endDate} 00:00:00`);
  }

  return {
    page,
    limit,
    offset,
    where: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    values,
  };
}

exports.listLogs = async (req, res) => {
  const options = getListingOptions(req.query, res);
  if (!options) return;

  try {
    const [[logs], [countRows]] = await Promise.all([
      db.query(
        `SELECT audit_logs.*,
                CONCAT_WS(' ', users.nombre, users.apellidos) AS user_name,
                users.email AS user_email
         FROM audit_logs
         LEFT JOIN users ON users.id = audit_logs.user_id
         ${options.where}
         ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
         LIMIT ? OFFSET ?`,
        [...options.values, options.limit, options.offset]
      ),
      db.query(
        `SELECT COUNT(*) AS total
         FROM audit_logs
         LEFT JOIN users ON users.id = audit_logs.user_id
         ${options.where}`,
        options.values
      ),
    ]);
    const total = Number(countRows[0]?.total) || 0;
    return res.json({
      logs,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    });
  } catch (error) {
    console.error('Error al consultar los logs de auditoría:', error);
    return res.status(500).json({ message: 'Error interno al consultar los logs de auditoría.' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const [[totalRows], [actionRows]] = await Promise.all([
      db.query('SELECT COUNT(*) AS total FROM audit_logs'),
      db.query(
        `SELECT action, COUNT(*) AS total
         FROM audit_logs
         GROUP BY action
         ORDER BY action`
      ),
    ]);
    return res.json({
      total: Number(totalRows[0]?.total) || 0,
      byAction: actionRows.map(({ action, total }) => ({
        action,
        total: Number(total) || 0,
      })),
    });
  } catch (error) {
    console.error('Error al consultar el resumen de auditoría:', error);
    return res.status(500).json({ message: 'Error interno al consultar el resumen de auditoría.' });
  }
};
