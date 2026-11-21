const assert = require('node:assert/strict');
const express = require('express');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/helpController');
const state = { calls: [], items: [] };
const helpContentModel = {
  async listActive(filters) {
    state.calls.push({ method: 'listActive', filters });
    return state.items.filter((item) => item.is_active);
  },
  async listAll(filters) {
    state.calls.push({ method: 'listAll', filters });
    return state.items;
  },
  async findActiveBySlug(slug) {
    state.calls.push({ method: 'findActiveBySlug', slug });
    return state.items.find((item) => item.slug === slug && item.is_active) || null;
  },
  async create(item) {
    state.calls.push({ method: 'create', item });
    const id = state.items.length + 1;
    state.items.push({ id, ...item });
    return id;
  },
  async findById(id) {
    return state.items.find((item) => item.id === id) || null;
  },
  async update(id, item) {
    const index = state.items.findIndex((entry) => entry.id === id);
    if (index < 0) return 0;
    if (JSON.stringify(state.items[index]) === JSON.stringify({ id, ...item })) return 0;
    state.items[index] = { id, ...item };
    return 1;
  },
  async delete(id) {
    const index = state.items.findIndex((entry) => entry.id === id);
    if (index < 0) return 0;
    state.items.splice(index, 1);
    return 1;
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../models/HelpContent' && parent.filename === controllerPath) return helpContentModel;
  return originalLoad.call(this, request, parent, isMain);
};
const controller = require(controllerPath);
Module._load = originalLoad;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function resetState() {
  state.calls = [];
  state.items = [];
}

const validItem = {
  title: 'Cómo enviar un artículo',
  slug: 'como-enviar-un-articulo',
  category: 'Envíos',
  content_type: 'guide',
  audience: 'author',
  content: 'Sigue estos pasos.',
  display_order: 2,
  is_active: true,
};

test('lists active contents with validated filters', async () => {
  resetState();
  state.items = [
    { id: 1, ...validItem },
    { id: 2, ...validItem, slug: 'borrador', is_active: false },
  ];
  const res = response();

  await controller.listActive({ query: { type: 'guide', audience: 'author' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 1);
  assert.deepEqual(state.calls[0], {
    method: 'listActive',
    filters: { content_type: 'guide', audience: 'author' },
  });

  const invalidRes = response();
  await controller.listActive({ query: { type: 'unknown' } }, invalidRes);
  assert.equal(invalidRes.statusCode, 400);
});

test('creates and updates help content, rejecting invalid input', async () => {
  resetState();
  const createRes = response();
  await controller.create({ body: validItem }, createRes);
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.item.slug, validItem.slug);

  const invalidRes = response();
  await controller.create({
    body: { ...validItem, content_type: 'article' },
  }, invalidRes);
  assert.equal(invalidRes.statusCode, 400);
  assert.equal(state.items.length, 1);

  const updateRes = response();
  await controller.update({
    params: { id: '1' },
    body: { ...validItem, title: 'Guía actualizada' },
  }, updateRes);
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.body.item.title, 'Guía actualizada');

  const unchangedRes = response();
  await controller.update({
    params: { id: '1' },
    body: { ...validItem, title: 'Guía actualizada' },
  }, unchangedRes);
  assert.equal(unchangedRes.statusCode, 200);
});

test('only returns active content by slug and deletes existing records', async () => {
  resetState();
  state.items = [
    { id: 1, ...validItem },
    { id: 2, ...validItem, slug: 'inactivo', is_active: false },
  ];

  const activeRes = response();
  await controller.getActiveBySlug({ params: { slug: validItem.slug } }, activeRes);
  assert.equal(activeRes.statusCode, 200);

  const inactiveRes = response();
  await controller.getActiveBySlug({ params: { slug: 'inactivo' } }, inactiveRes);
  assert.equal(inactiveRes.statusCode, 404);

  const deleteRes = response();
  await controller.delete({ params: { id: '1' } }, deleteRes);
  assert.equal(deleteRes.statusCode, 200);

  const missingRes = response();
  await controller.delete({ params: { id: '99' } }, missingRes);
  assert.equal(missingRes.statusCode, 404);
});

test('exposes public reads and restricts management routes to editors and admins', async () => {
  const routesPath = require.resolve('../src/routes/helpRoutes');
  const originalLoadForRoutes = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent.filename === routesPath && request === '../middlewares/authMiddleware') {
      return (req, res, next) => {
        const role = req.headers['x-test-role'];
        if (!role) return res.status(401).json({ message: 'Authentication required.' });
        req.user = { id: 'test-user', role };
        return next();
      };
    }
    if (parent.filename === routesPath && request === '../middlewares/auditMiddleware') {
      return () => (req, res, next) => next();
    }
    return originalLoadForRoutes.call(this, request, parent, isMain);
  };
  const helpRoutes = require(routesPath);
  Module._load = originalLoadForRoutes;

  resetState();
  const app = express();
  app.use(express.json());
  app.use('/api/help', helpRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/help`;

  try {
    const publicResponse = await fetch(baseUrl);
    assert.equal(publicResponse.status, 200);

    const unauthenticatedResponse = await fetch(`${baseUrl}/manage`);
    assert.equal(unauthenticatedResponse.status, 401);

    const authorResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'author' },
      body: JSON.stringify(validItem),
    });
    assert.equal(authorResponse.status, 403);

    const editorResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'editor' },
      body: JSON.stringify(validItem),
    });
    assert.equal(editorResponse.status, 201);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
