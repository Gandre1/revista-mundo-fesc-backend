const db = require('../config/db');

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function getRepositoryName(req) {
  return process.env.OAI_REPOSITORY_NAME || 'Revista Mundo FESC';
}

function getBaseUrl(req) {
  if (process.env.OAI_BASE_URL) return process.env.OAI_BASE_URL.replace(/\/$/, '');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${protocol}://${req.get('host')}/api/oai`;
}

function recordIdentifier(req, id) {
  const baseUrl = getBaseUrl(req);
  return `oai:${baseUrl.replace(/^https?:\/\//, '')}:${id}`;
}

const PUBLIC_RECORD_SQL = `
  SELECT s.id, s.titulo, s.resumen, s.palabras_clave, s.seccion, s.idioma,
         s.doi, s.pdf_galley_url, s.html_galley_url,
         s.fecha_envio, s.created_at, s.updated_at,
         i.volume, i.number, i.year, i.title AS issue_title,
         i.published_at, i.status AS issue_status
  FROM submissions s
  JOIN issues i ON i.id = s.issue_id
  WHERE i.status = 'published'
`;

async function getAuthors(submissionId) {
  const [authors] = await db.query(
    `SELECT nombre, apellidos, afiliacion, pais, orcid, es_corresponsal, orden
     FROM authors
     WHERE submission_id = ?
     ORDER BY orden ASC, id ASC`,
    [submissionId]
  );
  return authors;
}

async function getPublishedRecord(submissionId) {
  const [rows] = await db.query(
    `${PUBLIC_RECORD_SQL} AND s.id = ? LIMIT 1`,
    [submissionId]
  );
  if (!rows.length) return null;
  return { ...rows[0], authors: await getAuthors(submissionId) };
}

function xmlResponse(res, statusCode, xml) {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  return res.status(statusCode).send(XML_HEADER + '\n' + xml);
}

function oaiError(verb, errorCode, message) {
  return `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="${escapeXml(verb)}">${escapeXml(getBaseUrl({ headers: {}, get: () => '' }))}</request>
  <error code="${escapeXml(errorCode)}">${escapeXml(message)}</error>
</OAI-PMH>`;
}

exports.identify = async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const xml = `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="Identify">${escapeXml(baseUrl)}</request>
  <Identify>
    <repositoryName>${escapeXml(getRepositoryName(req))}</repositoryName>
    <baseURL>${escapeXml(baseUrl)}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>${escapeXml(process.env.OAI_ADMIN_EMAIL || '')}</adminEmail>
    <earliestDatestamp>2000-01-01</earliestDatestamp>
    <deletedRecord>no</deletedRecord>
    <granularity>YYYY-MM-DD</granularity>
  </Identify>
</OAI-PMH>`;
  return xmlResponse(res, 200, xml);
};

exports.listRecords = async (req, res) => {
  if (req.query.metadataPrefix !== 'oai_dc') {
    return xmlResponse(res, 200, `<OAI-PMH><error code="cannotDisseminateFormat">metadataPrefix debe ser oai_dc</error></OAI-PMH>`);
  }
  try {
    const [records] = await db.query(
      `${PUBLIC_RECORD_SQL} ORDER BY COALESCE(i.published_at, s.updated_at) DESC, s.id DESC`
    );
    const enriched = [];
    for (const record of records) enriched.push({ ...record, authors: await getAuthors(record.id) });

    const items = enriched.map((record) => oaiRecord(req, record)).join('\n');
    const xml = `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="ListRecords" metadataPrefix="oai_dc">${escapeXml(getBaseUrl(req))}</request>
  <ListRecords>${items}</ListRecords>
</OAI-PMH>`;
    return xmlResponse(res, 200, xml);
  } catch (error) {
    console.error('Error al generar ListRecords OAI-PMH:', error);
    return xmlResponse(res, 500, oaiError('ListRecords', 'idDoesNotExist', 'No se pudieron consultar los registros.'));
  }
};

function oaiRecord(req, record) {
  const identifier = recordIdentifier(req, record.id);
  const authors = record.authors || [];
  const date = formatDate(record.published_at || record.fecha_envio || record.created_at);
  const dcAuthors = authors.map((author) =>
    `      <dc:creator>${escapeXml(`${author.nombre || ''} ${author.apellidos || ''}`.trim())}</dc:creator>`
  ).join('\n');
  return `<record>
    <header>
      <identifier>${escapeXml(identifier)}</identifier>
      <datestamp>${escapeXml(date)}</datestamp>
    </header>
    <metadata>
      <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
        xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>${escapeXml(record.titulo)}</dc:title>
        <dc:description>${escapeXml(record.resumen || '')}</dc:description>
${dcAuthors}
        <dc:identifier>${escapeXml(record.doi || '')}</dc:identifier>
        <dc:date>${escapeXml(date)}</dc:date>
        <dc:language>${escapeXml(record.idioma || '')}</dc:language>
        <dc:type>${escapeXml(record.seccion || 'article')}</dc:type>
      </oai_dc:dc>
    </metadata>
  </record>`;
}

exports.getRecord = async (req, res) => {
  const identifier = typeof req.query.identifier === 'string' ? req.query.identifier.trim() : '';
  const metadataPrefix = req.query.metadataPrefix;
  if (metadataPrefix !== 'oai_dc') {
    return xmlResponse(res, 200, `<OAI-PMH><error code="cannotDisseminateFormat">metadataPrefix debe ser oai_dc</error></OAI-PMH>`);
  }
  const match = identifier.match(/:([^:]+)$/);
  const submissionId = match ? match[1] : identifier;
  if (!submissionId) {
    return xmlResponse(res, 400, oaiError('GetRecord', 'badArgument', 'Falta el identificador.'));
  }
  try {
    const record = await getPublishedRecord(submissionId);
    if (!record) return xmlResponse(res, 404, oaiError('GetRecord', 'idDoesNotExist', 'Registro no encontrado.'));
    const xml = `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="GetRecord" identifier="${escapeXml(identifier)}" metadataPrefix="oai_dc">${escapeXml(getBaseUrl(req))}</request>
  <GetRecord>${oaiRecord(req, record)}</GetRecord>
</OAI-PMH>`;
    return xmlResponse(res, 200, xml);
  } catch (error) {
    console.error('Error al generar GetRecord OAI-PMH:', error);
    return xmlResponse(res, 500, oaiError('GetRecord', 'idDoesNotExist', 'No se pudo consultar el registro.'));
  }
};

exports.oai = async (req, res) => {
  const verb = typeof req.query.verb === 'string' ? req.query.verb.trim() : '';
  if (verb === 'Identify') return exports.identify(req, res);
  if (verb === 'ListRecords') return exports.listRecords(req, res);
  if (verb === 'GetRecord') return exports.getRecord(req, res);
  return xmlResponse(res, 400, `<OAI-PMH><error code="badVerb">Verbo OAI-PMH no válido o ausente.</error></OAI-PMH>`);
};

exports.exportScieloXml = async (req, res) => {
  const submissionId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!submissionId) return res.status(400).json({ message: 'El identificador del artículo no es válido.' });
  try {
    const record = await getPublishedRecord(submissionId);
    if (!record) {
      return res.status(404).json({ message: 'Artículo no encontrado o no publicado.' });
    }
    const pubDate = formatDate(record.published_at || record.fecha_envio || record.created_at);
    const authors = record.authors.map((author) => {
      const fullName = `${author.nombre || ''} ${author.apellidos || ''}`.trim();
      return `        <contrib contrib-type="author">
          <name><surname>${escapeXml(author.apellidos || '')}</surname><given-names>${escapeXml(author.nombre || '')}</given-names></name>
          <xref ref-type="aff" rid="aff1"/>
        </contrib>`;
    }).join('\n');
    const galleyLinks = [
      record.pdf_galley_url ? `          <self-uri content-type="application/pdf" xlink:href="${escapeXml(record.pdf_galley_url)}"/>` : '',
      record.html_galley_url ? `          <self-uri content-type="text/html" xlink:href="${escapeXml(record.html_galley_url)}"/>` : '',
    ].filter(Boolean).join('\n');

    const xml = `<article xmlns:xlink="http://www.w3.org/1999/xlink" article-type="research-article" dtd-version="1.3" xml:lang="${escapeXml(record.idioma || 'es')}">
  <front>
    <journal-meta>
      <journal-title-group><journal-title>Revista Mundo FESC</journal-title></journal-title-group>
    </journal-meta>
    <article-meta>
      <title-group><article-title>${escapeXml(record.titulo)}</article-title></title-group>
      <contrib-group>
${authors}
      </contrib-group>
      <aff id="aff1"><institution>${escapeXml(record.authors.find((a) => a.afiliacion)?.afiliacion || '')}</institution><country>${escapeXml(record.authors.find((a) => a.pais)?.pais || '')}</country></aff>
      <pub-date publication-format="electronic" date-type="pub">
        <year>${escapeXml(pubDate.slice(0, 4))}</year><month>${escapeXml(pubDate.slice(5, 7))}</month><day>${escapeXml(pubDate.slice(8, 10))}</day>
      </pub-date>
      <volume>${escapeXml(record.volume)}</volume>
      <issue>${escapeXml(record.number)}</issue>
      <article-id pub-id-type="doi">${escapeXml(record.doi || '')}</article-id>
      <abstract><p>${escapeXml(record.resumen || '')}</p></abstract>
${galleyLinks}
    </article-meta>
  </front>
  <body/>
  <back/>
</article>`;
    return xmlResponse(res, 200, xml);
  } catch (error) {
    console.error('Error al generar XML SciELO:', error);
    return res.status(500).json({ message: 'Error interno al generar el XML SciELO.' });
  }
};
