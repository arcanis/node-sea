import {npath}            from '@yarnpkg/fslib';
import {mountMemoryDrive} from '@yarnpkg/libzip';
import fs                 from 'fs';
import {Module}           from 'module';
import path               from 'path';

declare const parameters: {
  data: string;
  bin: Array<string> | undefined;
  main: Array<string> | undefined;
};

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

function findBin(manifest: any, name: string | undefined) {
  if (typeof manifest.bin === `string`) {
    if (typeof name !== `undefined` && name !== manifest.name) {
      throw new Error(`Unknown CLI in SEA application`);
    } else {
      return manifest.bin;
    }
  }

  const keys = Object.keys(manifest.bin);
  if (typeof name === `undefined` && keys.length === 1)
    return manifest.bin[keys[0]];

  const finalName = name ?? manifest.name;
  if (Object.prototype.hasOwnProperty.call(manifest.bin, finalName) && typeof manifest.bin[finalName] === `string`)
    return manifest.bin[finalName];

  throw new Error(`Unknown CLI in SEA application`);
}

function forwardRequireTo(target: Array<string> | undefined, subPathFactory: (manifest: any, hint: string | undefined) => string | undefined) {
  if (typeof target === `undefined`)
    throw new Error(`This SEA application doesn't support this access method`);

  const pkgPath = require.resolve(`${target[0]}/package.json`, {paths: [path.join(mountPoint, `package`)]});
  const pkgDir = path.dirname(pkgPath);

  const subPath = subPathFactory(require(pkgPath), target[1]) ?? `./`;
  const resolvedPath = require.resolve(subPath, {paths: [pkgDir]});

  return require(resolvedPath);
}

process.env.NODE_OPTIONS ??= ``;
process.env.NODE_OPTIONS += ` --require ${JSON.stringify(__filename)}`;

if (require.main === module)
  forwardRequireTo(parameters.bin, (manifest, hint) => findBin(manifest, hint).replace(/^(?!\.{0,2}\/)/, `./`));
else
  module.exports = forwardRequireTo(parameters.main, () => undefined);
