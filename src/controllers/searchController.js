const db = require('../config/db');

const publishedSubmissionStatuses = "'aceptado', 'accepted', 'aprobado', 'publicado', 'published'";
const publishedIssueCondition = `(
  i.status = 'published'
  OR (i.status = 'scheduled' AND i.published_at IS NOT NULL
      AND i.published_at <= CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'))
)`;

const getTextFilter = (value, name, maxLength = 255) => {
  if (value === undefined) return { value: null };
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    return { error: `El parámetro ${name} no es válido.` };
  }
  return { value: value.trim() || null };
};

const getPositiveInteger = (value, name, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined) return { value: fallback };
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return { error: `El parámetro ${name} debe ser un entero positivo.` };
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    return { error: `El parámetro ${name} debe ser un entero positivo${maximum < Number.MAX_SAFE_INTEGER ? ` no mayor que ${maximum}` : ''}.` };
  }
  return { value: parsed };
};

exports.searchPublicArticles = async (req, res) => {
  const rawQuery = req.query.q === undefined ? req.query.query : req.query.q;
  const queryFilter = getTextFilter(rawQuery, 'q', 500);
  const authorFilter = getTextFilter(req.query.author, 'author');
  const sectionFilter = getTextFilter(req.query.section, 'section');
  const doiFilter = getTextFilter(req.query.doi, 'doi');
  const volumeFilter = getPositiveInteger(req.query.volume, 'volume');
  const issueFilter = getPositiveInteger(req.query.issue, 'issue');
  const yearFilter = getPositiveInteger(req.query.year, 'year');
  const pageFilter = getPositiveInteger(req.query.page, 'page', 1);
  const limitFilter = getPositiveInteger(req.query.limit, 'limit', 20, 100);
  const sort = req.query.sort === undefined
    ? (queryFilter.value ? 'relevance' : 'recent')
    : req.query.sort;

  const invalidFilter = [
    queryFilter,
    authorFilter,
    sectionFilter,
    doiFilter,
    volumeFilter,
    issueFilter,
    yearFilter,
    pageFilter,
    limitFilter,
  ].find((filter) => filter.error);
  if (invalidFilter) return res.status(400).json({ message: invalidFilter.error });
  if (typeof sort !== 'string' || !['relevance', 'recent', 'title'].includes(sort)) {
    return res.status(400).json({ message: 'El parámetro sort debe ser relevance, recent o title.' });
  }

  const conditions = [
    `LOWER(TRIM(s.estado)) IN (${publishedSubmissionStatuses})`,
    publishedIssueCondition,
  ];
  const values = [];
  const like = (value) => `%${value}%`;

  if (queryFilter.value) {
    conditions.push('(s.titulo LIKE ? OR s.resumen LIKE ? OR s.palabras_clave LIKE ?)');
    values.push(like(queryFilter.value), like(queryFilter.value), like(queryFilter.value));
  }
  if (authorFilter.value) {
    conditions.push(`EXISTS (
      SELECT 1 FROM authors a
      WHERE a.submission_id = s.id
        AND CONCAT_WS(' ', a.nombre, a.apellidos, a.email, a.afiliacion) LIKE ?
    )`);
    values.push(like(authorFilter.value));
  }
  if (volumeFilter.value) {
    conditions.push('i.volume = ?');
    values.push(volumeFilter.value);
  }
  if (issueFilter.value) {
    conditions.push('i.number = ?');
    values.push(issueFilter.value);
  }
  if (sectionFilter.value) {
    conditions.push('s.seccion LIKE ?');
    values.push(like(sectionFilter.value));
  }
  if (yearFilter.value) {
    conditions.push('i.year = ?');
    values.push(yearFilter.value);
  }
  if (doiFilter.value) {
    conditions.push('s.doi LIKE ?');
    values.push(like(doiFilter.value));
  }

  const whereClause = conditions.join('\n AND ');
  let orderClause;
  let orderValues = [];
  if (sort === 'title') {
    orderClause = 's.titulo ASC, s.id ASC';
  } else if (sort === 'relevance' && queryFilter.value) {
    orderClause = `CASE
      WHEN s.titulo LIKE ? THEN 1
      WHEN s.resumen LIKE ? THEN 2
      WHEN s.palabras_clave LIKE ? THEN 3
      ELSE 4
    END ASC, i.published_at DESC, s.id ASC`;
    orderValues = [queryFilter.value, queryFilter.value, queryFilter.value].map(like);
  } else {
    orderClause = 'i.published_at DESC, s.id ASC';
  }

  const page = pageFilter.value;
  const limit = limitFilter.value;
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) {
    return res.status(400).json({ message: 'El parámetro page está fuera del rango permitido.' });
  }

  try {
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM submissions s
       JOIN issues i ON i.id = s.issue_id
       WHERE ${whereClause}`,
      values,
    );
    const [articles] = await db.query(
      `SELECT s.id, s.titulo, s.resumen, s.palabras_clave, s.seccion, s.idioma,
              s.doi, s.fecha_envio, s.created_at,
              i.id AS issue_id, i.volume, i.number AS issue, i.year,
              i.published_at,
              (SELECT GROUP_CONCAT(CONCAT_WS(' ', a.nombre, a.apellidos)
                                   ORDER BY a.orden ASC, a.id ASC SEPARATOR ', ')
               FROM authors a
               WHERE a.submission_id = s.id) AS authors
       FROM submissions s
       JOIN issues i ON i.id = s.issue_id
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`,
      [...values, ...orderValues, limit, offset],
    );
    const total = Number(countRows[0]?.total || 0);
    return res.status(200).json({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al buscar artículos públicos:', error);
    return res.status(500).json({ message: 'Error interno al buscar artículos públicos.' });
  }
};
