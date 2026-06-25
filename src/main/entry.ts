import { app } from 'electron';
import * as path from 'path';

// 1. Set app name BEFORE any app.getPath() calls
app.setName('Dash');

// Dev-only: run an isolated instance (own DB, own single-instance lock) alongside
// a normal Dash by setting DASH_USER_DATA_DIR. Must happen before any getPath('userData').
if (process.env.DASH_USER_DATA_DIR) {
  app.setPath('userData', process.env.DASH_USER_DATA_DIR);
}

// 2. Install path aliases for main process
// @shared/* → dist/main/shared/*
// @/* → dist/main/main/*
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
) {
  if (request.startsWith('@shared/')) {
    request = request.replace('@shared/', path.join(__dirname, '..', 'shared') + '/');
  } else if (request.startsWith('@/')) {
    request = request.replace('@/', __dirname + '/');
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// 3. Load main process
require('./main');
