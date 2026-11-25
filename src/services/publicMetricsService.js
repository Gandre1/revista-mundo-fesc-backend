const db = require('../config/db');

const metricColumns = {
  view: 'views',
  download: 'downloads',
};

exports.increment = async (submissionId, metric) => {
  const column = metricColumns[metric];
  if (!column) throw new Error(`Tipo de métrica pública no válido: ${metric}`);

  await db.query(
    `INSERT INTO article_metrics (submission_id, ${column})
     VALUES (?, 1)
     ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
    [submissionId],
  );
};
