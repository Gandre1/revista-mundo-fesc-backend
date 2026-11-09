const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/emailTemplateController');
const state = { templates: [], calls: [] };

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

    if (normalizedSql.startsWith('insert into email_templates')) {
      if (state.templates.some((template) => template.template_key === values[0])) {
        const error = new Error('Duplicate template key');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      const template = {
        id: state.templates.length + 1,
        template_key: values[0],
        name: values[1],
        subject: values[2],
        body_html: values[3],
        variables_disponibles: values[4],
        created_at: '2026-11-09 08:00:00',
        updated_at: '2026-11-09 08:00:00',
      };
      state.templates.push(template);
      return [{ insertId: template.id }];
    }
    if (normalizedSql.startsWith('select id, template_key') && normalizedSql.includes('where template_key = ?')) {
      return [state.templates.filter((template) => template.template_key === values[0])];
    }
    if (normalizedSql.startsWith('select id, template_key')) {
      return [[...state.templates].sort((a, b) => a.name.localeCompare(b.name))];
    }
    if (normalizedSql.startsWith('update email_templates')) {
      const template = state.templates.find((item) => item.template_key === values[4]);
      if (template) {
        [template.name, template.subject, template.body_html, template.variables_disponibles] = values.slice(0, 4);
      }
      return [{ affectedRows: template ? 1 : 0 }];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === controllerPath) return db;
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
  state.templates = [];
  state.calls = [];
}

const validTemplate = {
  template_key: 'submission_update',
  name: 'Actualización del envío',
  subject: 'Hola {{nombre_autor}}: {{titulo_articulo}}',
  body_html: '<p>Tu rol es {{rol}}</p>',
};

test('creates a template and discovers dynamic variables from its content', async () => {
  resetState();
  const res = response();

  await controller.createTemplate({ body: validTemplate }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.template.template_key, 'submission_update');
  assert.deepEqual(res.body.template.variables_disponibles, [
    'nombre_autor',
    'titulo_articulo',
    'rol',
  ]);
  assert.equal(state.templates.length, 1);
});

test('lists and retrieves templates with variables decoded as a list', async () => {
  resetState();
  state.templates = [{
    id: 1,
    template_key: 'welcome',
    name: 'Bienvenida',
    subject: 'Hola {{nombre_autor}}',
    body_html: '<p>{{rol}}</p>',
    variables_disponibles: '["nombre_autor","rol"]',
  }];

  const listRes = response();
  await controller.listTemplates({}, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.templates.length, 1);
  assert.deepEqual(listRes.body.templates[0].variables_disponibles, ['nombre_autor', 'rol']);

  const getRes = response();
  await controller.getTemplateByKey({ params: { templateKey: 'welcome' } }, getRes);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.template.name, 'Bienvenida');
  assert.deepEqual(getRes.body.template.variables_disponibles, ['nombre_autor', 'rol']);
});

test('updates a template and returns 404 for an unknown key', async () => {
  resetState();
  state.templates = [{
    id: 2,
    template_key: 'submission_update',
    name: 'Actualización anterior',
    subject: 'Anterior',
    body_html: '<p>Anterior</p>',
    variables_disponibles: '[]',
  }];
  const res = response();
  await controller.updateTemplate({
    params: { templateKey: 'submission_update' },
    body: {
      name: 'Actualización revisada',
      subject: 'Artículo {{titulo_articulo}}',
      body_html: '<p>Hola {{nombre_autor}}</p>',
    },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.template.name, 'Actualización revisada');
  assert.deepEqual(res.body.template.variables_disponibles, ['titulo_articulo', 'nombre_autor']);

  const missingRes = response();
  await controller.updateTemplate({
    params: { templateKey: 'missing' },
    body: validTemplate,
  }, missingRes);
  assert.equal(missingRes.statusCode, 404);
});

test('rejects invalid input and duplicate keys', async () => {
  resetState();
  const missingBodyRes = response();
  await controller.createTemplate({ body: undefined }, missingBodyRes);
  assert.equal(missingBodyRes.statusCode, 400);

  const invalidRes = response();
  await controller.createTemplate({
    body: { ...validTemplate, variables_disponibles: ['nombre autor'] },
  }, invalidRes);
  assert.equal(invalidRes.statusCode, 400);
  assert.equal(state.calls.length, 0);

  const duplicateTemplate = { ...validTemplate, variables_disponibles: ['nombre_autor'] };
  await controller.createTemplate({ body: duplicateTemplate }, response());
  const duplicateRes = response();
  await controller.createTemplate({ body: duplicateTemplate }, duplicateRes);
  assert.equal(duplicateRes.statusCode, 409);
});
