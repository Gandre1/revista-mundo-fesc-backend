const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/exportController');
const state = {
  records: [],
  authors: [],
  calls: [],
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

    if (normalizedSql.startsWith('select nombre, apellidos')) {
      return [state.authors];
    }
    if (normalizedSql.includes('from submissions s') && normalizedSql.includes("i.status = 'published'")) {
      return [state.records];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === controllerPath) {
    return db;
  }
  return originalLoad.call(this, request, parent, isMain);
};

const controller = require(controllerPath);
Module._load = originalLoad;

function request(query = {}, params = {}, headers = {}) {
  return {
    query,
    params,
    protocol: 'http',
    headers,
    get(name) {
      const normalizedName = name.toLowerCase();
      if (normalizedName === 'host') return 'localhost:4000';
      if (normalizedName === 'accept') return headers.accept;
      return undefined;
    },
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const publishedRecord = {
  id: 'articulo-123',
  titulo: 'Evaluación de tecnologías educativas',
  resumen: 'Resumen científico del artículo.',
  palabras_clave: 'educación, tecnología',
  seccion: 'Investigación',
  idioma: 'es',
  doi: '10.1234/revista.123',
  pdf_galley_url: 'https://example.org/articulo.pdf',
  html_galley_url: 'https://example.org/articulo.html',
  fecha_envio: '2026-01-10',
  created_at: '2026-01-10',
  updated_at: '2026-02-10',
  volume: 7,
  number: 2,
  year: 2026,
  issue_title: 'Edición de ciencias',
  published_at: '2026-03-01',
  issue_status: 'published',
};

test('browser navigation cannot view the OAI-PMH metadata feed', async () => {
  const res = response();
  await controller.oai(request(
    { verb: 'ListRecords', metadataPrefix: 'oai_dc' },
    {},
    { accept: 'text/html,application/xhtml+xml' },
  ), res);

  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /intercambio automatizado/i);
});

test('ListRecords OAI-PMH returns Dublin Core XML and application/xml', async () => {
  state.records = [publishedRecord];
  state.authors = [{
    nombre: 'Ana',
    apellidos: 'Pérez',
    afiliacion: 'Universidad FESC',
    pais: 'Colombia',
  }];
  const res = response();

  await controller.oai(request({ verb: 'ListRecords', metadataPrefix: 'oai_dc' }), res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^application\/xml/);
  assert.match(res.body, /<ListRecords>/);
  assert.match(res.body, /<dc:title>Evaluación de tecnologías educativas<\/dc:title>/);
  assert.match(res.body, /<dc:creator>Ana Pérez<\/dc:creator>/);
  assert.match(res.body, /<dc:identifier>10\.1234\/revista\.123<\/dc:identifier>/);
  assert.match(res.body, /oai_dc:dc/);
});

test('Identify and GetRecord expose valid OAI-PMH XML', async () => {
  const identifyResponse = response();
  await controller.oai(request({ verb: 'Identify' }), identifyResponse);
  assert.match(identifyResponse.body, /<Identify>/);
  assert.match(identifyResponse.body, /<protocolVersion>2\.0<\/protocolVersion>/);
  assert.match(identifyResponse.headers['content-type'], /^application\/xml/);

  state.records = [publishedRecord];
  state.authors = [{ nombre: 'Ana', apellidos: 'Pérez' }];
  const getResponse = response();
  await controller.oai(request({
    verb: 'GetRecord',
    identifier: 'oai:localhost:4000:articulo-123',
    metadataPrefix: 'oai_dc',
  }), getResponse);
  assert.equal(getResponse.statusCode, 200);
  assert.match(getResponse.body, /<GetRecord>/);
  assert.match(getResponse.body, /articulo-123/);
});

test('SciELO export includes article metadata only for published records', async () => {
  state.records = [publishedRecord];
  state.authors = [{
    nombre: 'Ana',
    apellidos: 'Pérez',
    afiliacion: 'Universidad FESC',
    pais: 'Colombia',
  }];
  const res = response();

  await controller.exportScieloXml(request({}, { id: 'articulo-123' }), res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^application\/xml/);
  assert.match(res.body, /<article-title>Evaluación de tecnologías educativas<\/article-title>/);
  assert.match(res.body, /<surname>Pérez<\/surname><given-names>Ana<\/given-names>/);
  assert.match(res.body, /<article-id pub-id-type="doi">10\.1234\/revista\.123<\/article-id>/);
  assert.match(res.body, /<volume>7<\/volume>/);
  assert.match(res.body, /<issue>2<\/issue>/);
  assert.match(res.body, /application\/pdf/);
  assert.ok(state.calls.some((call) => call.sql.includes("i.status = 'published'")));
});
