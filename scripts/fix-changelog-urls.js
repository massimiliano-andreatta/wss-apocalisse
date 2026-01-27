#!/usr/bin/env node
/**
 * Sostituisce personal.github.com con github.com nel CHANGELOG.
 * Il remote può restare personal.github.com; i link "per aprire la pagina" devono usare github.com.
 */
const fs = require('fs');
const path = require('path');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
if (!fs.existsSync(changelogPath)) process.exit(0);
const content = fs.readFileSync(changelogPath, 'utf8');
fs.writeFileSync(changelogPath, content.replace(/personal\.github\.com/g, 'github.com'));
