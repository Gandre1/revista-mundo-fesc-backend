const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const issueRoutes = require('../src/routes/issueRoutes');
const submissionRoutes = require('../src/routes/submissionRoutes');

const originalJwtSecret = process.env.JWT_SECRET;
const testSecret = 'role-access-tests-secret';
const app = express();
app.use(express.json());
app.use('/api/issues', issueRoutes);
app.use('/api/submissions', submissionRoutes);

let server;
let baseUrl;

test.before(async () => {
  process.env.JWT_SECRET = testSecret;
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

function headersFor(role) {
  if (!role) return {};
  const token = jwt.sign({ id: `${role}-1`, role }, testSecret);
  return { Authorization: `Bearer ${token}` };
}

test('issue management list requires an authenticated editorial role', async () => {
  const anonymous = await fetch(`${baseUrl}/api/issues`);
  assert.equal(anonymous.status, 401);

  const author = await fetch(`${baseUrl}/api/issues`, { headers: headersFor('author') });
  assert.equal(author.status, 403);

  const reviewer = await fetch(`${baseUrl}/api/issues`, { headers: headersFor('reviewer') });
  assert.equal(reviewer.status, 403);
});

test('only authors and administrators may create submissions', async () => {
  const anonymous = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'Test' }),
  });
  assert.equal(anonymous.status, 401);

  const reviewer = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headersFor('reviewer') },
    body: JSON.stringify({ titulo: 'Test' }),
  });
  assert.equal(reviewer.status, 403);

  const editor = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headersFor('editor') },
    body: JSON.stringify({ titulo: 'Test' }),
  });
  assert.equal(editor.status, 403);
});
