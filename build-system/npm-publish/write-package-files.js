/**
 * @fileoverview
 * Creates npm package files for a given component and AMP version.
 */

const [extension, ampVersion, extensionVersion] = process.argv.slice(2);
const fastGlob = require('fast-glob');
const path = require('path');
const {getNameWithoutComponentPrefix} = require('../tasks/bento-helpers');
const {getSemver} = require('./utils');
const {log} = require('../common/logging');
const {stat, writeFile} = require('fs/promises');
const {valid} = require('semver');

const packageName = getNameWithoutComponentPrefix(extension);

/**
 * Determines whether to skip
 * @return {Promise<boolean>}
 */
async function shouldSkip() {
  try {
    await stat(`extensions/${extension}/${extensionVersion}`);
    return false;
  } catch {
    log(`${extension} ${extensionVersion} : skipping, does not exist`);
    return true;
  }
}

/**
 * Returns relative paths to all the extension's CSS file
 *
 * @return {Promise<string[]>}
 */
async function getStylesheets() {
  const extDir = `extensions/${extension}/${extensionVersion}/dist`
    .split('/')
    .join(path.sep);
  const files = await fastGlob(path.join(extDir, '**', '*.css'));
  return files.map((file) => path.relative(extDir, file));
}

/**
 * Write package.json
 * @return {Promise<void>}
 */
async function writePackageJson() {
  const version = getSemver(extensionVersion, ampVersion);
  if (!valid(version) || ampVersion.length != 13) {
    log(
      'Invalid semver version',
      version,
      'or AMP version',
      ampVersion,
      'or extension version',
      extensionVersion
    );
    process.exitCode = 1;
    return;
  }

  const exports = {
    '.': './web-component',
    './web-component': {
      import: './dist/web-component.module.js',
      require: './dist/web-component.js',
    },
    './preact': {
      import: './dist/component-preact.module.js',
      require: './dist/component-preact.js',
    },
    './react': {
      import: './dist/component-react.module.js',
      require: './dist/component-react.js',
    },
  };

  for (const stylesheet of await getStylesheets()) {
    exports[`./${stylesheet}`] = `./dist/${stylesheet}`;
  }
  const json = {
    name: `@bentoproject/${packageName}`,
    version,
    description: `Bento ${packageName} Component`,
    author: 'Bento Authors',
    license: 'Apache-2.0',
    main: './dist/web-component.js',
    module: './dist/web-component.module.js',
    exports,
    files: ['dist/*', 'react.js'],
    repository: {
      type: 'git',
      url: 'https://github.com/ampproject/amphtml.git',
      directory: `extensions/${extension}/${extensionVersion}`,
    },
    homepage: `https://github.com/ampproject/amphtml/tree/main/extensions/${extension}/${extensionVersion}`,
    peerDependencies: {
      preact: '^10.2.1',
      react: '^17.0.0',
    },
  };

  try {
    await writeFile(
      `extensions/${extension}/${extensionVersion}/package.json`,
      JSON.stringify(json, null, 2)
    );
    log(
      json.name,
      extensionVersion,
      ': created package.json for',
      json.version
    );
  } catch (e) {
    log(e);
    process.exitCode = 1;
    return;
  }
}

/**
 * Write react.js
 * @return {Promise<void>}
 */
async function writeReactJs() {
  const content = "module.exports = require('./dist/component-react');";
  try {
    await writeFile(
      `extensions/${extension}/${extensionVersion}/react.js`,
      content
    );
    log(packageName, extensionVersion, ': created react.js');
  } catch (e) {
    log(e);
    process.exitCode = 1;
    return;
  }
}

/**
 * Main
 * @return {Promise<void>}
 */
async function main() {
  if (await shouldSkip()) {
    return;
  }
  writePackageJson();
  writeReactJs();
}

main();
