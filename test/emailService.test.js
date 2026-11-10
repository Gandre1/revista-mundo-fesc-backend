const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const servicePath = require.resolve('../src/services/emailService');
const calls = { queries: [], transports: [], messages: [] };
const template = {
  subject: 'Hola {{nombre_autor}}: {{titulo_articulo}}',
  body_html: '<p>{{nombre_autor}}</p><p>{{titulo_articulo}}</p><p>{{rol}}</p>',
};
const db = {
  async query(sql, values) {
    calls.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
    return [[template]];
  },
};
const nodemailer = {
  createTransport(options) {
    calls.transports.push(options);
    return {
      async sendMail(message) {
        calls.messages.push(message);
        return { messageId: 'message-1' };
      },
    };
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === servicePath) return db;
  if (request === 'nodemailer' && parent.filename === servicePath) return nodemailer;
  return originalLoad.call(this, request, parent, isMain);
};
const emailService = require(servicePath);
Module._load = originalLoad;

const smtpVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
const originalEnvironment = Object.fromEntries(
  smtpVariables.map((key) => [key, process.env[key]])
);

function configureSmtp() {
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.example.org',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'smtp-user',
    SMTP_PASS: 'smtp-password',
    SMTP_FROM: 'Revista FESC <no-reply@example.org>',
  });
}

function restoreEnvironment() {
  for (const key of smtpVariables) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
}

test('seeds missing workflow templates without overwriting existing customizations', async () => {
  calls.queries.length = 0;

  await emailService.ensureDefaultTemplates();

  assert.equal(calls.queries.length, 1);
  assert.match(calls.queries[0].sql, /^INSERT IGNORE INTO email_templates/);
  assert.deepEqual(
    calls.queries[0].values.filter((_, index) => index % 5 === 0),
    [
      'submission_accepted',
      'submission_rejected',
      'submission_changes_requested',
      'reviewer_assigned',
    ]
  );
  assert.ok(calls.queries[0].values.includes(
    JSON.stringify(['nombre_autor', 'titulo_articulo', 'estado', 'comentarios_editor', 'rol', 'submission_id'])
  ));
});

test('renders institutional templates and escapes substituted HTML values', async () => {
  calls.queries.length = 0;
  calls.transports.length = 0;
  calls.messages.length = 0;
  configureSmtp();

  const result = await emailService.sendTemplateEmail('submission_accepted', 'author@example.org', {
    nombre_autor: '<Ana>',
    titulo_articulo: 'Métodos & datos',
    rol: 'autor',
  });

  assert.deepEqual(result, { messageId: 'message-1' });
  assert.deepEqual(calls.queries[0].values, ['submission_accepted']);
  assert.deepEqual(calls.transports[0], {
    host: 'smtp.example.org',
    port: 465,
    secure: true,
    auth: { user: 'smtp-user', pass: 'smtp-password' },
  });
  assert.deepEqual(calls.messages[0], {
    from: 'Revista FESC <no-reply@example.org>',
    to: 'author@example.org',
    subject: 'Hola <Ana>: Métodos & datos',
    html: '<p>&lt;Ana&gt;</p><p>Métodos &amp; datos</p><p>autor</p>',
  });
  restoreEnvironment();
});

test('rejects missing template variables and invalid SMTP configuration', async () => {
  assert.throws(
    () => emailService.renderTemplate('Hola {{nombre}}', {}),
    /variable "nombre" y no fue proporcionada/
  );
  assert.equal(
    emailService.renderTemplate('<b>{{nombre}}</b>', { nombre: '<Ana>' }, true),
    '<b>&lt;Ana&gt;</b>'
  );

  Object.assign(process.env, { SMTP_HOST: '', SMTP_FROM: '' });
  await assert.rejects(
    emailService.sendTemplateEmail('submission_accepted', 'author@example.org', {
      nombre_autor: 'Ana',
      titulo_articulo: 'Artículo',
      rol: 'autor',
    }),
    /configurar SMTP_HOST y SMTP_FROM/
  );
  restoreEnvironment();
});
