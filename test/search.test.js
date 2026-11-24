const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/searchController');
const state = {
  total: 0,
  articles: [],
  calls: [],
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });
    if (normalizedSql.startsWith('select count(*) as total')) {
      return [[{ total: state.total }]];
    }
    if (normalizedSql.startsWith('select s.id, s.titulo')) {
      return [state.articles];
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

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('combines public article filters and returns consistent pagination', async () => {
  state.calls = [];
  state.total = 6;
  state.articles = [{ id: 'article-1', titulo: 'Energía sostenible' }];
  const res = response();

  await controller.searchPublicArticles({
    query: {
      q: 'energía',
      author: 'Ana Pérez',
      volume: '4',
      issue: '2',
      section: 'Investigación',
      year: '2025',
      doi: '10.1234',
      sort: 'relevance',
      page: '2',
      limit: '5',
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.articles, state.articles);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 5, total: 6, totalPages: 2 });
  assert.equal(state.calls.length, 2);
  assert.match(state.calls[0].sql, /lower\(trim\(s\.estado\)\) in/);
  assert.match(state.calls[0].sql, /i\.status = 'published'/);
  assert.match(state.calls[0].sql, /from authors a/);
  assert.deepEqual(state.calls[0].values, [
    '%energía%', '%energía%', '%energía%', '%Ana Pérez%',
    4, 2, '%Investigación%', 2025, '%10.1234%',
  ]);
  assert.match(state.calls[1].sql, /case when s\.titulo like \?/);
  assert.deepEqual(state.calls[1].values, [
    ...state.calls[0].values,
    '%energía%', '%energía%', '%energía%', 5, 5,
  ]);
});

test('accepts query alias and returns an empty result set with zero pages', async () => {
  state.calls = [];
  state.total = 0;
  state.articles = [];
  const res = response();

  await controller.searchPublicArticles({ query: { query: 'vacuna' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.articles, []);
  assert.deepEqual(res.body.pagination, { page: 1, limit: 20, total: 0, totalPages: 0 });
  assert.match(state.calls[1].sql, /order by case/);
});

test('rejects invalid pagination and sort parameters', async () => {
  const invalidPageResponse = response();
  await controller.searchPublicArticles({ query: { page: '0' } }, invalidPageResponse);
  assert.equal(invalidPageResponse.statusCode, 400);

  const oversizedOffsetResponse = response();
  await controller.searchPublicArticles({
    query: { page: '9007199254740991', limit: '100' },
  }, oversizedOffsetResponse);
  assert.equal(oversizedOffsetResponse.statusCode, 400);

  const invalidSortResponse = response();
  await controller.searchPublicArticles({ query: { sort: 'random' } }, invalidSortResponse);
  assert.equal(invalidSortResponse.statusCode, 400);
});
