const db = require('../config/db');

const publishedSubmissionStatuses = "'aceptado', 'accepted', 'aprobado', 'publicado', 'published'";
const publishedIssueCondition = `(
  i.status = 'published'
  OR (i.status = 'scheduled' AND i.published_at IS NOT NULL
      AND i.published_at <= CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'))
)`;

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const getInitials = (name) => clean(name).split(/\s+/).filter(Boolean).map((part) => `${part[0]}.`).join(' ');
const getApaAuthor = (author) => `${clean(author.apellidos)}, ${getInitials(author.nombre)}`;
const bibtexCharacterMap = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '&': '\\&',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

function getArticleId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function getPublishedArticle(articleId) {
  const [articles] = await db.query(
    `SELECT s.id, s.titulo, s.doi, i.volume, i.number, i.year
     FROM submissions s
     JOIN issues i ON i.id = s.issue_id
     WHERE s.id = ?
       AND LOWER(TRIM(s.estado)) IN (${publishedSubmissionStatuses})
       AND ${publishedIssueCondition}
     LIMIT 1`,
    [articleId],
  );
  if (!articles.length) return null;

  const [authors] = await db.query(
    `SELECT nombre, apellidos
     FROM authors
     WHERE submission_id = ?
     ORDER BY orden ASC, id ASC`,
    [articleId],
  );
  return { ...articles[0], authors };
}

function formatApa(article, url) {
  const authorNames = article.authors.map(getApaAuthor);
  let apaAuthors = authorNames;
  if (authorNames.length > 20) {
    apaAuthors = [...authorNames.slice(0, 19), '\u2026', authorNames[authorNames.length - 1]];
  }
  const authorText = apaAuthors.length > 1
    ? `${apaAuthors.slice(0, -1).join(', ')}, & ${apaAuthors[apaAuthors.length - 1]}`
    : apaAuthors[0] || '';
  const issue = article.number ? `(${article.number})` : '';
  const doiText = article.doi ? `https://doi.org/${clean(article.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}` : url;
  return `${authorText}${authorText ? ' ' : ''}(${article.year}). ${clean(article.titulo)}. Revista Mundo FESC, ${article.volume}${issue}. ${doiText}`;
}

function formatIeee(article, url) {
  const authors = article.authors.map((author) => {
    return `${getInitials(author.nombre)} ${clean(author.apellidos)}`;
  });
  let authorText = '';
  if (authors.length === 1) authorText = authors[0];
  else if (authors.length === 2) authorText = `${authors[0]} and ${authors[1]}`;
  else if (authors.length > 2) authorText = `${authors.slice(0, -1).join(', ')}, and ${authors[authors.length - 1]}`;

  const issue = article.number ? `, no. ${article.number}` : '';
  const doiText = article.doi ? `, doi: ${clean(article.doi)}` : `, ${url}`;
  return `${authorText}${authorText ? ', ' : ''}"${clean(article.titulo)}," Revista Mundo FESC, vol. ${article.volume}${issue}, ${article.year}${doiText}.`;
}

function bibtexEscape(value) {
  return clean(value).replace(/[\\{}&%$#_~^]/g, (character) => bibtexCharacterMap[character]);
}

function formatBibtex(article, url) {
  const key = `fesc${article.year}${String(article.id).replace(/[^a-zA-Z0-9]/g, '')}`;
  const authors = article.authors.map((author) => `${clean(author.apellidos)}, ${clean(author.nombre)}`).join(' and ');
  const fields = [
    `  author = {${bibtexEscape(authors)}}`,
    `  title = {${bibtexEscape(article.titulo)}}`,
    '  journal = {Revista Mundo FESC}',
    `  year = {${article.year}}`,
    `  volume = {${article.volume}}`,
  ];
  if (article.number) fields.push(`  number = {${article.number}}`);
  if (article.doi) fields.push(`  doi = {${bibtexEscape(article.doi)}}`);
  fields.push(`  url = {${bibtexEscape(url)}}`);
  return `@article{${key},\n${fields.join(',\n')}\n}`;
}

function formatRis(article, url) {
  const lines = [
    'TY  - JOUR',
    ...article.authors.map((author) => `AU  - ${clean(author.apellidos)}, ${clean(author.nombre)}`),
    `TI  - ${clean(article.titulo)}`,
    'JO  - Revista Mundo FESC',
    `VL  - ${article.volume}`,
  ];
  if (article.number) lines.push(`IS  - ${article.number}`);
  lines.push(`PY  - ${article.year}`);
  if (article.doi) lines.push(`DO  - ${clean(article.doi)}`);
  lines.push(`UR  - ${url}`, 'ER  -');
  return lines.join('\r\n');
}

function getArticleUrl(req, article) {
  return `${req.protocol}://${req.get('host')}/api/public/submissions/${encodeURIComponent(article.id)}`;
}

function getCitation(article, url, style) {
  if (style === 'apa') return formatApa(article, url);
  if (style === 'ieee') return formatIeee(article, url);
  return null;
}

exports.getCitation = async (req, res) => {
  const articleId = getArticleId(req.params.id);
  if (!articleId) return res.status(400).json({ message: 'El identificador del artículo no es válido.' });

  const style = req.query.style === undefined ? 'apa' : req.query.style;
  if (typeof style !== 'string' || !['apa', 'ieee'].includes(style.toLowerCase())) {
    return res.status(400).json({ message: 'El parámetro style debe ser apa o ieee.' });
  }

  try {
    const article = await getPublishedArticle(articleId);
    if (!article) return res.status(404).json({ message: 'Artículo publicado no encontrado.' });
    const url = getArticleUrl(req, article);
    const normalizedStyle = style.toLowerCase();
    return res.json({
      articleId: article.id,
      style: normalizedStyle,
      citation: getCitation(article, url, normalizedStyle),
    });
  } catch (error) {
    console.error('Error al generar la cita bibliográfica:', error);
    return res.status(500).json({ message: 'Error interno al generar la cita bibliográfica.' });
  }
};

exports.exportCitation = async (req, res) => {
  const articleId = getArticleId(req.params.id);
  if (!articleId) return res.status(400).json({ message: 'El identificador del artículo no es válido.' });
  const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : '';
  if (!['bibtex', 'ris'].includes(format)) {
    return res.status(400).json({ message: 'El parámetro format debe ser bibtex o ris.' });
  }

  try {
    const article = await getPublishedArticle(articleId);
    if (!article) return res.status(404).json({ message: 'Artículo publicado no encontrado.' });
    const url = getArticleUrl(req, article);
    const content = format === 'bibtex' ? formatBibtex(article, url) : formatRis(article, url);
    const extension = format === 'bibtex' ? 'bib' : 'ris';
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="article-${article.id}.${extension}"`,
    });
    return res.send(content);
  } catch (error) {
    console.error('Error al exportar la cita bibliográfica:', error);
    return res.status(500).json({ message: 'Error interno al exportar la cita bibliográfica.' });
  }
};

exports.getMetrics = async (req, res) => {
  const articleId = getArticleId(req.params.id);
  if (!articleId) return res.status(400).json({ message: 'El identificador del artículo no es válido.' });

  try {
    const [rows] = await db.query(
      `SELECT s.id, COALESCE(m.views, 0) AS views, COALESCE(m.downloads, 0) AS downloads
       FROM submissions s
       JOIN issues i ON i.id = s.issue_id
       LEFT JOIN article_metrics m ON m.submission_id = s.id
       WHERE s.id = ?
         AND LOWER(TRIM(s.estado)) IN (${publishedSubmissionStatuses})
         AND ${publishedIssueCondition}
       LIMIT 1`,
      [articleId],
    );
    if (!rows.length) return res.status(404).json({ message: 'Artículo publicado no encontrado.' });
    return res.json({
      articleId: rows[0].id,
      views: Number(rows[0].views) || 0,
      downloads: Number(rows[0].downloads) || 0,
    });
  } catch (error) {
    console.error('Error al consultar las métricas públicas del artículo:', error);
    return res.status(500).json({ message: 'Error interno al consultar las métricas públicas.' });
  }
};
