const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const test = require('node:test');
const { createUploadMiddleware } = require('../src/middlewares/uploadMiddleware');

test('review annotation uploads accept PDF/DOC/DOCX, reject other extensions, and enforce 10 MB', async () => {
  const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fesc-review-upload-'));
  const storedPaths = [];
  const app = express();
  app.post('/review-annotation', createUploadMiddleware(uploadDirectory, 'review-annotation').single('archivo'), (req, res) => {
    storedPaths.push(req.file.path);
    res.json({ originalname: req.file.originalname });
  });
  app.use((error, req, res, next) => {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'size' });
    if (error.code === 'INVALID_FILE_TYPE') return res.status(400).json({ message: 'extension' });
    return next(error);
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/review-annotation`;

  const upload = async (name, contents) => {
    const formData = new FormData();
    formData.append('archivo', new Blob([contents]), name);
    return fetch(endpoint, { method: 'POST', body: formData });
  };

  try {
    for (const extension of ['pdf', 'doc', 'docx']) {
      const response = await upload(`annotations.${extension}`, 'review notes');
      assert.equal(response.status, 200);
      assert.equal((await response.json()).originalname, `annotations.${extension}`);
    }

    const unsupported = await upload('annotations.txt', 'review notes');
    assert.equal(unsupported.status, 400);
    assert.deepEqual(await unsupported.json(), { message: 'extension' });

    const oversized = await upload('annotations.pdf', Buffer.alloc(10 * 1024 * 1024 + 1));
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { message: 'size' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const storedPath of storedPaths) {
      if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
    }
    fs.rmdirSync(uploadDirectory);
  }
});
