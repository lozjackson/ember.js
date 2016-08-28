#!/usr/bin/env node

global.QUnit = require('qunitjs');

// Adds test reporting.
var qe = require('qunit-extras');
qe.runInContext(global);

var glob = require('glob');
var root = 'tests/';

function addFiles(files) {
  glob.sync(root + files)
    .map(function(name) {
      return "../" + name.substring(0, name.length - 3);
    })
    .forEach(require);
}

addFiles('/**/app-boot-test.js');

QUnit.load();
