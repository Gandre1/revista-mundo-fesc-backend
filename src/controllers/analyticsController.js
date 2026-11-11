const db = require('../config/db');

const ARTICLE_STATUSES = [
  'submitted',
  'under_review',
  'changes_requested',
  'accepted',
  'rejected',
  'published',
];

const normalizeCount = (value) => Number(value) || 0;
const roundToTwoDecimals = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

exports.getOverview = async (req, res) => {
  try {
    const [statusRows, userRows] = await Promise.all([
      db.query(
        `SELECT CASE
           WHEN LOWER(TRIM(estado)) IN ('enviado', 'submitted', 'recibido') THEN 'submitted'
           WHEN LOWER(TRIM(estado)) IN ('en_revision', 'en revisión', 'under_review', 'evaluado', 'evaluated') THEN 'under_review'
           WHEN LOWER(TRIM(estado)) IN ('revisiones_requeridas', 'revisiones requeridas', 'revisions_required', 'changes_requested', 'changes requested', 'ajustes_solicitados') THEN 'changes_requested'
           WHEN LOWER(TRIM(estado)) IN ('aceptado', 'accepted', 'aprobado', 'approved') THEN 'accepted'
           WHEN LOWER(TRIM(estado)) IN ('rechazado', 'rejected') THEN 'rejected'
           WHEN LOWER(TRIM(estado)) IN ('publicado', 'published') THEN 'published'
         END AS status, COUNT(*) AS total
         FROM submissions
         WHERE LOWER(TRIM(estado)) IN (
           'enviado', 'submitted', 'recibido',
           'en_revision', 'en revisión', 'under_review', 'evaluado', 'evaluated',
           'revisiones_requeridas', 'revisiones requeridas', 'revisions_required', 'changes_requested', 'changes requested', 'ajustes_solicitados',
           'aceptado', 'accepted', 'aprobado', 'approved',
           'rechazado', 'rejected', 'publicado', 'published'
         )
         GROUP BY status`
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

    return res.json({ totalArticles, articlesByStatus, acceptanceRate, usersByRole });
  } catch (error) {
    console.error('Error al consultar el resumen de analíticas:', error);
    return res.status(500).json({ message: 'Error interno al consultar las analíticas.' });
  }
};

exports.getEditorialTimes = async (req, res) => {
  try {
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
           AND decisions.decision_at >= s.fecha_envio`
      ),
      db.query(
        `SELECT COUNT(*) AS assigned,
                SUM(CASE
                  WHEN LOWER(TRIM(estado)) IN ('completado', 'completada', 'completed', 'complete', 'evaluado', 'evaluated', 'enviado', 'submitted', 'reviewed')
                  THEN 1 ELSE 0
                END) AS completed
         FROM submission_reviews`
      ),
    ]);

    const averageDaysValue = decisionRows[0][0]?.average_days;
    const averageDecisionDays = averageDaysValue === null || averageDaysValue === undefined
      ? null
      : roundToTwoDecimals(Number(averageDaysValue));
    const assigned = normalizeCount(reviewRows[0][0]?.assigned);
    const completed = normalizeCount(reviewRows[0][0]?.completed);

    return res.json({
      averageDecisionDays,
      reviews: {
        assigned,
        completed,
        pending: Math.max(0, assigned - completed),
        completionRate: assigned ? roundToTwoDecimals((completed / assigned) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Error al consultar los tiempos editoriales:', error);
    return res.status(500).json({ message: 'Error interno al consultar los tiempos editoriales.' });
  }
};

exports.getIssuesSummary = async (req, res) => {
  try {
    const [issues] = await db.query(
      `SELECT i.id, i.volume, i.number, i.year, i.title, i.published_at,
              COUNT(s.id) AS articles_count
       FROM issues i
       INNER JOIN submissions s ON s.issue_id = i.id
       WHERE i.status = 'published'
         AND LOWER(TRIM(s.estado)) IN ('publicado', 'published')
       GROUP BY i.id, i.volume, i.number, i.year, i.title, i.published_at
       ORDER BY i.year DESC, i.volume DESC, i.number DESC`
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
