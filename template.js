// @ts-check

const {npath} = require(`@yarnpkg/fslib`);
const {mountMemoryDrive} = require(`@yarnpkg/libzip`);
const fs = require(`fs`);
const {Module} = require(`module`);
const path = require(`path`);

const parameters = {data: `<%DATA%>`, bin: `<%BIN%>`, main: `<%MAIN%>`};

// @ts-expect-error
if (typeof Module._stat === `undefined`)
  throw new Error(`Only modern builds of Node are supported`);

const mountPoint = npath.toPortablePath(__filename);
const mountData = Buffer.from(parameters.data, `base64`);

mountMemoryDrive(fs, mountPoint, mountData);

// @ts-expect-error
Module._stat = p => {
  try {
    const stat = fs.statSync(p);
    return +!!(stat.mode & fs.constants.S_IFDIR);
  } catch {
    return -1;
  }
};

// @ts-expect-error
Module._readPackage = p => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(p, `package.json`), `utf8`));
  } catch {
    return ``;
  }
};

function findBin(manifest) {
  if (typeof manifest.bin === `string`)
    return manifest.bin;

  const keys = Object.keys(manifest.bin);
  if (keys.length === 1)
    return manifest.bin[keys[0]];

  if (manifest.bin[manifest.name])
    return manifest.bin[manifest.name];

  return undefined;
}

function forwardRequireTo(target, subPathFactory) {
  if (typeof target === `undefined`)
    throw new Error(`This SEA application doesn't support this access method`);

  const pkgPath = require.resolve(`${target[0]}/package.json`, {paths: [mountPoint]});
  const pkgDir = path.dirname(pkgPath);

  const subPath = target[1] ?? subPathFactory(require(pkgPath)) ?? `./`;
  const resolvedPath = require.resolve(subPath, {paths: [pkgDir]});

  return require(resolvedPath);
}

if (require.main === module)
  forwardRequireTo(parameters.bin, manifest => findBin(manifest));
else
  module.exports = forwardRequireTo(parameters.main, () => `./`);
