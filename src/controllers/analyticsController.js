const db = require('../config/db');

const ARTICLE_STATUSES = [
  'submitted',
  'under_review',
  'changes_requested',
  'accepted',
  'rejected',
  'published',
];

const COMPLETED_REVIEW_STATUSES = [
  'completado',
  'completada',
  'completed',
  'complete',
  'evaluado',
  'evaluated',
  'enviado',
  'submitted',
  'reviewed',
];

const normalizeCount = (value) => Number(value) || 0;
const roundToTwoDecimals = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function getFilters(req, res) {
  const { startDate, endDate, issueId, section } = req.query;
  if ((startDate !== undefined && !isValidDate(startDate))
    || (endDate !== undefined && !isValidDate(endDate))) {
    res.status(400).json({ message: 'Las fechas deben tener el formato AAAA-MM-DD y ser válidas.' });
    return null;
  }
  if (startDate && endDate && startDate > endDate) {
    res.status(400).json({ message: 'La fecha de inicio no puede ser posterior a la fecha final.' });
    return null;
  }

  let parsedIssueId;
  if (issueId !== undefined) {
    parsedIssueId = Number(issueId);
    if (!/^[1-9]\d*$/.test(String(issueId)) || !Number.isSafeInteger(parsedIssueId)) {
      res.status(400).json({ message: 'El identificador del número no es válido.' });
      return null;
    }
  }
  if (section !== undefined && (typeof section !== 'string' || !section.trim())) {
    res.status(400).json({ message: 'La sección no es válida.' });
    return null;
  }

  return {
    startDate,
    endDate,
    issueId: parsedIssueId,
    section: typeof section === 'string' ? section.trim() : undefined,
  };
}

function buildSubmissionFilters(filters, alias = 's') {
  const clauses = [];
  const values = [];
  if (filters.startDate) {
    clauses.push(`${alias}.fecha_envio >= ?`);
    values.push(`${filters.startDate} 00:00:00`);
  }
  if (filters.endDate) {
    clauses.push(`${alias}.fecha_envio < DATE_ADD(?, INTERVAL 1 DAY)`);
    values.push(`${filters.endDate} 00:00:00`);
  }
  if (filters.issueId !== undefined) {
    clauses.push(`${alias}.issue_id = ?`);
    values.push(filters.issueId);
  }
  if (filters.section) {
    clauses.push(`${alias}.seccion = ?`);
    values.push(filters.section);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values };
}

async function getOverviewData(filters) {
  const submissionFilters = buildSubmissionFilters(filters);
  const [statusRows, userRows] = await Promise.all([
    db.query(
      `SELECT CASE
           WHEN LOWER(TRIM(s.estado)) IN ('enviado', 'submitted', 'recibido') THEN 'submitted'
           WHEN LOWER(TRIM(s.estado)) IN ('en_revision', 'en revisión', 'under_review', 'evaluado', 'evaluated') THEN 'under_review'
           WHEN LOWER(TRIM(s.estado)) IN ('revisiones_requeridas', 'revisiones requeridas', 'revisions_required', 'changes_requested', 'changes requested', 'ajustes_solicitados') THEN 'changes_requested'
           WHEN LOWER(TRIM(s.estado)) IN ('aceptado', 'accepted', 'aprobado', 'approved') THEN 'accepted'
           WHEN LOWER(TRIM(s.estado)) IN ('rechazado', 'rejected') THEN 'rejected'
           WHEN LOWER(TRIM(s.estado)) IN ('publicado', 'published') THEN 'published'
         END AS status, COUNT(*) AS total
         FROM submissions s
         WHERE LOWER(TRIM(s.estado)) IN (
           'enviado', 'submitted', 'recibido',
           'en_revision', 'en revisión', 'under_review', 'evaluado', 'evaluated',
           'revisiones_requeridas', 'revisiones requeridas', 'revisions_required', 'changes_requested', 'changes requested', 'ajustes_solicitados',
           'aceptado', 'accepted', 'aprobado', 'approved',
           'rechazado', 'rejected', 'publicado', 'published'
         )${submissionFilters.sql}
         GROUP BY status`,
      submissionFilters.values
    ),
    db.query(
      `SELECT role, COUNT(*) AS total
         FROM users
         GROUP BY role`
    ),
  ]);

  const articlesByStatus = Object.fromEntries(ARTICLE_STATUSES.map((status) => [status, 0]));
  for (const row of statusRows[0]) {
    if (Object.prototype.hasOwnProperty.call(articlesByStatus, row.status)) {
      articlesByStatus[row.status] = normalizeCount(row.total);
    }
  }

  const usersByRole = {};
  for (const row of userRows[0]) {
    usersByRole[row.role] = normalizeCount(row.total);
  }

  const totalArticles = Object.values(articlesByStatus).reduce((total, count) => total + count, 0);
  const decidedArticles = articlesByStatus.accepted + articlesByStatus.published + articlesByStatus.rejected;
  const acceptanceRate = decidedArticles
    ? roundToTwoDecimals(((articlesByStatus.accepted + articlesByStatus.published) / decidedArticles) * 100)
    : 0;

  return { totalArticles, articlesByStatus, acceptanceRate, usersByRole };
}

async function getEditorialTimesData(filters) {
  const submissionFilters = buildSubmissionFilters(filters);
  const [decisionRows, reviewRows] = await Promise.all([
    db.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, s.fecha_envio, decisions.decision_at) / 86400) AS average_days
       FROM submissions s
       INNER JOIN (
         SELECT submission_id, MIN(created_at) AS decision_at
         FROM submission_audit_logs
         WHERE action = 'status_updated'
           AND (
             LOWER(description) LIKE '%estado actualizado a publicado%'
             OR LOWER(description) LIKE '%estado actualizado a rechazado%'
             OR LOWER(description) LIKE '%estado actualizado a revisiones_requeridas%'
             OR LOWER(description) LIKE '%estado actualizado a changes_requested%'
             OR LOWER(description) LIKE '%estado actualizado a accepted%'
             OR LOWER(description) LIKE '%estado actualizado a rejected%'
           )
         GROUP BY submission_id
       ) decisions ON decisions.submission_id = s.id
       WHERE s.fecha_envio IS NOT NULL
         AND decisions.decision_at >= s.fecha_envio${submissionFilters.sql}`,
      submissionFilters.values
    ),
    db.query(
      `SELECT COUNT(*) AS assigned,
              SUM(CASE
                WHEN LOWER(TRIM(sr.estado)) IN (${COMPLETED_REVIEW_STATUSES.map(() => '?').join(', ')})
                THEN 1 ELSE 0
              END) AS completed
       FROM submission_reviews sr
       INNER JOIN submissions s ON s.id = sr.submission_id
       WHERE 1 = 1${submissionFilters.sql}`,
      [...COMPLETED_REVIEW_STATUSES, ...submissionFilters.values]
    ),
  ]);

  const averageDaysValue = decisionRows[0][0]?.average_days;
  const averageDecisionDays = averageDaysValue === null || averageDaysValue === undefined
    ? null
    : roundToTwoDecimals(Number(averageDaysValue));
  const assigned = normalizeCount(reviewRows[0][0]?.assigned);
  const completed = normalizeCount(reviewRows[0][0]?.completed);

  return {
    averageDecisionDays,
    reviews: {
      assigned,
      completed,
      pending: Math.max(0, assigned - completed),
      completionRate: assigned ? roundToTwoDecimals((completed / assigned) * 100) : 0,
    },
  };
}

exports.getOverview = async (req, res) => {
  const filters = getFilters(req, res);
  if (!filters) return;

  try {
    return res.json(await getOverviewData(filters));
  } catch (error) {
    console.error('Error al consultar el resumen de analíticas:', error);
    return res.status(500).json({ message: 'Error interno al consultar las analíticas.' });
  }
};

exports.getEditorialTimes = async (req, res) => {
  const filters = getFilters(req, res);
  if (!filters) return;

  try {
    return res.json(await getEditorialTimesData(filters));
  } catch (error) {
    console.error('Error al consultar los tiempos editoriales:', error);
    return res.status(500).json({ message: 'Error interno al consultar los tiempos editoriales.' });
  }
};

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  const safeText = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

exports.exportCsv = async (req, res) => {
  const filters = getFilters(req, res);
  if (!filters) return;

  try {
    const [overview, editorialTimes] = await Promise.all([
      getOverviewData(filters),
      getEditorialTimesData(filters),
    ]);
    const rows = [
      ['Categoría', 'Métrica', 'Valor'],
      ['Resumen', 'Total de artículos', overview.totalArticles],
      ...ARTICLE_STATUSES.map((status) => ['Artículos por estado', status, overview.articlesByStatus[status]]),
      ['Resumen', 'Tasa de aceptación (%)', overview.acceptanceRate],
      ...Object.entries(overview.usersByRole).map(([role, total]) => ['Usuarios por rol', role, total]),
      ['Métricas editoriales', 'Promedio de días hasta la decisión', editorialTimes.averageDecisionDays],
      ['Revisiones', 'Asignadas', editorialTimes.reviews.assigned],
      ['Revisiones', 'Completadas', editorialTimes.reviews.completed],
      ['Revisiones', 'Pendientes', editorialTimes.reviews.pending],
      ['Revisiones', 'Tasa de finalización (%)', editorialTimes.reviews.completionRate],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="analytics-report.csv"',
    });
    return res.send(csv);
  } catch (error) {
    console.error('Error al exportar el informe de analíticas:', error);
    return res.status(500).json({ message: 'Error interno al exportar las analíticas.' });
  }
};

exports.getIssuesSummary = async (req, res) => {
  const filters = getFilters(req, res);
  if (!filters) return;

  try {
    const submissionFilters = buildSubmissionFilters(filters);
    const [issues] = await db.query(
      `SELECT i.id, i.volume, i.number, i.year, i.title, i.published_at,
              COUNT(s.id) AS articles_count
       FROM issues i
       INNER JOIN submissions s ON s.issue_id = i.id
       WHERE i.status = 'published'
         AND LOWER(TRIM(s.estado)) IN ('publicado', 'published')${submissionFilters.sql}
       GROUP BY i.id, i.volume, i.number, i.year, i.title, i.published_at
       ORDER BY i.year DESC, i.volume DESC, i.number DESC`,
      submissionFilters.values
    );

    return res.json({
      issues: issues.map((issue) => ({
        ...issue,
        articles_count: normalizeCount(issue.articles_count),
      })),
    });
  } catch (error) {
    console.error('Error al consultar el resumen de números publicados:', error);
    return res.status(500).json({ message: 'Error interno al consultar el resumen de números publicados.' });
  }
};

exports.getReviewers = async (req, res) => {
  const filters = getFilters(req, res);
  if (!filters) return;

  try {
    const submissionFilters = buildSubmissionFilters(filters);
    const [reviewers] = await db.query(
      `SELECT CONCAT_WS(' ', u.nombre, u.apellidos) AS nombre,
              u.email AS correo,
              COUNT(s.id) AS assigned_reviews,
              SUM(CASE
                WHEN s.id IS NOT NULL
                  AND LOWER(TRIM(sr.estado)) IN (${COMPLETED_REVIEW_STATUSES.map(() => '?').join(', ')})
                THEN 1 ELSE 0
              END) AS completed_reviews,
              AVG(CASE
                WHEN s.id IS NOT NULL
                  AND LOWER(TRIM(sr.estado)) IN (${COMPLETED_REVIEW_STATUSES.map(() => '?').join(', ')})
                  AND s.updated_at >= sr.created_at
                THEN TIMESTAMPDIFF(SECOND, sr.created_at, s.updated_at) / 86400
              END) AS average_response_days
       FROM users u
       LEFT JOIN submission_reviews sr ON sr.reviewer_id = u.id
       LEFT JOIN submissions s ON s.id = sr.submission_id${submissionFilters.sql}
       WHERE u.role = 'reviewer'
       GROUP BY u.id, u.nombre, u.apellidos, u.email
       ORDER BY u.apellidos ASC, u.nombre ASC`,
      [
        ...submissionFilters.values,
        ...COMPLETED_REVIEW_STATUSES,
        ...COMPLETED_REVIEW_STATUSES,
      ]
    );

    return res.json({
      reviewers: reviewers.map((reviewer) => {
        const assignedReviews = normalizeCount(reviewer.assigned_reviews);
        const completedReviews = normalizeCount(reviewer.completed_reviews);
        const responseDays = reviewer.average_response_days === null
          || reviewer.average_response_days === undefined
          ? null
          : roundToTwoDecimals(Number(reviewer.average_response_days));
        return {
          nombre: reviewer.nombre,
          correo: reviewer.correo,
          assignedReviews,
          completedReviews,
          pendingReviews: Math.max(0, assignedReviews - completedReviews),
          completionRate: assignedReviews
            ? roundToTwoDecimals((completedReviews / assignedReviews) * 100)
            : 0,
          averageResponseDays: responseDays,
        };
      }),
    });
  } catch (error) {
    console.error('Error al consultar el rendimiento de evaluadores:', error);
    return res.status(500).json({ message: 'Error interno al consultar el rendimiento de evaluadores.' });
  }
};
