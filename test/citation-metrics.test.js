const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const express = require('express');

const state = {
  published: true,
  doi: '10.1234/fesc.2026.1',
  views: 0,
  downloads: 0,
  calls: [],
  galleyPath: '',
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });
    if (normalizedSql.startsWith('update issues set status')) return [{ affectedRows: 0 }];
    if (normalizedSql.startsWith('select s.id, s.titulo, s.doi, i.volume')) {
      return [state.published ? [{
        id: 'article-1',
        titulo: 'Investigación sobre energía',
        doi: state.doi,
        volume: 4,
        number: 2,
        year: 2026,
      }] : []];
    }
    if (normalizedSql.startsWith('select nombre, apellidos from authors')) {
      return [[
        { nombre: 'Ana María', apellidos: 'Pérez' },
        { nombre: 'Luis', apellidos: 'Gómez' },
      ]];
    }
    if (normalizedSql.startsWith('select s.id, coalesce(m.views')) {
      return [state.published ? [{
        id: 'article-1',
        views: state.views,
        downloads: state.downloads,
      }] : []];
    }
    if (normalizedSql.startsWith('select s.id, s.titulo, s.resumen')) {
      return [state.published ? [{
        id: 'article-1',
        titulo: 'Investigación sobre energía',
        resumen: 'Resumen del artículo',
        palabras_clave: 'energía',
        seccion: 'Investigación',
        idioma: 'es',
        estado: 'publicado',
        doi: '10.1234/fesc.2026.1',
        issue_id: 1,
        volume: 4,
        number: 2,
        year: 2026,
        issue_status: 'published',
      }] : []];
    }
    if (normalizedSql.startsWith('select nombre, apellidos, email, afiliacion')) {
      return [[{ nombre: 'Ana María', apellidos: 'Pérez', orden: 1 }]];
    }
    if (normalizedSql.startsWith('select nombre_original, tipo from submission_files')) {
      return [[{ nombre_original: 'articulo.html', tipo: 'galley-html' }]];
    }
    if (normalizedSql.startsWith('select s.id from submissions s')) {
      return [state.published ? [{ id: 'article-1' }] : []];
    }
    if (normalizedSql.startsWith('select nombre_original, ruta_almacenamiento, tipo')) {
      return [[{
        nombre_original: 'articulo.html',
        ruta_almacenamiento: state.galleyPath,
        tipo: 'galley-html',
      }]];
    }
    if (normalizedSql.startsWith('insert into article_metrics')) {
      if (normalizedSql.includes('(submission_id, views)')) state.views += 1;
      if (normalizedSql.includes('(submission_id, downloads)')) state.downloads += 1;
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return db;
  return originalLoad.call(this, request, parent, isMain);
};
const publicRoutes = require('../src/routes/publicRoutes');
Module._load = originalLoad;

const app = express();
app.use('/api/public', publicRoutes);
let server;
let baseUrl;
const fixturePath = path.resolve(process.cwd(), 'uploads', `test-public-metrics-${process.pid}.html`);
state.galleyPath = path.relative(process.cwd(), fixturePath);

test.before(async () => {
  state.published = true;
  state.views = 0;
  state.downloads = 0;
  fs.writeFileSync(fixturePath, '<html><body>Artículo</body></html>');
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
});

test('returns APA 7 and IEEE citations for public articles', async () => {
  const apaResponse = await fetch(`${baseUrl}/api/public/articles/article-1/citation`);
  assert.equal(apaResponse.status, 200);
  const apa = await apaResponse.json();
  assert.equal(apa.style, 'apa');
  assert.match(apa.citation, /Pérez, A\. M\., & Gómez, L\./);
  assert.match(apa.citation, /\(2026\)\. Investigación sobre energía\./);
  assert.match(apa.citation, /Revista Mundo FESC, 4\(2\)\./);
  assert.match(apa.citation, /https:\/\/doi\.org\/10\.1234\/fesc\.2026\.1/);

  const ieeeResponse = await fetch(`${baseUrl}/api/public/articles/article-1/citation?style=ieee`);
  assert.equal(ieeeResponse.status, 200);
  const ieee = await ieeeResponse.json();
  assert.equal(ieee.style, 'ieee');
  assert.match(ieee.citation, /A\. M\. Pérez and L\. Gómez/);
  assert.match(ieee.citation, /"Investigación sobre energía," Revista Mundo FESC, vol\. 4, no\. 2, 2026/);
  assert.match(ieee.citation, /doi: 10\.1234\/fesc\.2026\.1/);
});

test('exports BibTeX and RIS files with publication metadata', async () => {
  const bibtexResponse = await fetch(`${baseUrl}/api/public/articles/article-1/citation/export?format=bibtex`);
  assert.equal(bibtexResponse.status, 200);
  assert.match(bibtexResponse.headers.get('content-disposition'), /\.bib"/);
  const bibtex = await bibtexResponse.text();
  assert.match(bibtex, /^@article\{fesc2026article1,/);
  assert.match(bibtex, /author = \{Pérez, Ana María and Gómez, Luis\}/);
  assert.match(bibtex, /doi = \{10\.1234\/fesc\.2026\.1\}/);

  const risResponse = await fetch(`${baseUrl}/api/public/articles/article-1/citation/export?format=ris`);
  assert.equal(risResponse.status, 200);
  assert.match(risResponse.headers.get('content-disposition'), /\.ris"/);
  const ris = await risResponse.text();
  assert.match(ris, /TY  - JOUR/);
  assert.match(ris, /AU  - Pérez, Ana María/);
  assert.match(ris, /DO  - 10\.1234\/fesc\.2026\.1/);
  assert.match(ris, /ER  -/);
});

test('uses the public article URL when no DOI is available', async () => {
  state.doi = null;
  const citationResponse = await fetch(`${baseUrl}/api/public/articles/article-1/citation`);
  const citation = await citationResponse.json();
  assert.match(citation.citation, /http:\/\/127\.0\.0\.1:\d+\/api\/public\/submissions\/article-1/);

  const risResponse = await fetch(`${baseUrl}/api/public/articles/article-1/citation/export?format=ris`);
  const ris = await risResponse.text();
  assert.match(ris, /UR  - http:\/\/127\.0\.0\.1:\d+\/api\/public\/submissions\/article-1/);
  assert.doesNotMatch(ris, /DO  -/);
  state.doi = '10.1234/fesc.2026.1';
});

test('does not expose citations or metrics for unpublished articles and rejects unknown formats', async () => {
  state.published = false;
  for (const endpoint of [
    '/api/public/articles/article-1/citation',
    '/api/public/articles/article-1/citation/export?format=ris',
    '/api/public/articles/article-1/metrics',
  ]) {
    const response = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(response.status, 404);
  }
  state.published = true;
  const invalidStyle = await fetch(`${baseUrl}/api/public/articles/article-1/citation?style=mla`);
  const invalidFormat = await fetch(`${baseUrl}/api/public/articles/article-1/citation/export?format=xml`);
  assert.equal(invalidStyle.status, 400);
  assert.equal(invalidFormat.status, 400);
});

test('records public detail views and galley downloads and returns metrics', async () => {
  state.views = 0;
  state.downloads = 0;
  const detail = await fetch(`${baseUrl}/api/public/submissions/article-1`);
  assert.equal(detail.status, 200);
  assert.equal(state.views, 1);

  const galley = await fetch(`${baseUrl}/api/public/submissions/article-1/galley/html`);
  assert.equal(galley.status, 200);
  assert.equal(await galley.text(), '<html><body>Artículo</body></html>');
  assert.equal(state.downloads, 1);

  const metrics = await fetch(`${baseUrl}/api/public/articles/article-1/metrics`);
  assert.equal(metrics.status, 200);
  assert.deepEqual(await metrics.json(), {
    articleId: 'article-1',
    views: 1,
    downloads: 1,
  });
  assert.ok(state.calls.some(({ sql }) => sql.startsWith('insert into article_metrics (submission_id, views)')));
  assert.ok(state.calls.some(({ sql }) => sql.startsWith('insert into article_metrics (submission_id, downloads)')));
});
