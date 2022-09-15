import {FakeFS, GetMountPointFn, MountFS, MountFSOptions, NodeFS, npath, patchFs, PortablePath, PosixFS, ZipFS} from '@yarnpkg/fslib';
import {getLibzipSync}                   from '@yarnpkg/libzip';
import resolve                           from 'enhanced-resolve';
import fs                                from 'fs';
import {Module}                          from 'module';

import {lodash}                          from './lodash';

const mountPoint = npath.toPortablePath(__filename);

// @ts-expect-error
Module._findPath = (request, paths, isMain) => {
  return resolve(resolve.sync(request, paths[0]));
};

const openArchive = (baseFs: FakeFS<PortablePath>, p: PortablePath) => {
  return new ZipFS(Buffer.from(lodash.replace(/\s+/g, ``), `base64`), {
    libzip: getLibzipSync(),
  });
};

const getMountPoint: GetMountPointFn = (p: PortablePath) => {
  const detectedMountPoint = p.startsWith(`${mountPoint}/`) ? p.slice(0, mountPoint.length) as PortablePath : null;
  console.log({p, detectedMountPoint})
  return detectedMountPoint;
};

const factoryPromise: MountFSOptions<ZipFS>[`factoryPromise`] = async (baseFs, p) => {
  return () => openArchive(baseFs, p);
};

const factorySync: MountFSOptions<ZipFS>[`factorySync`] = (baseFs, p) => {
  return openArchive(baseFs, p);
};

// We must copy the fs into a local, because otherwise
// 1. we would make the NodeFS instance use the function that we patched (infinite loop)
// 2. Object.create(fs) isn't enough, since it won't prevent the proto from being modified
const localFs: typeof fs = {...fs};
const nodeFs = new NodeFS(localFs);

const mountFs = new MountFS({
  baseFs: nodeFs,

  getMountPoint,

  factoryPromise,
  factorySync,
});

patchFs(fs, new PosixFS(mountFs));

console.log(eval(`require`)(`${mountPoint}/node_modules/lodash/index.js`));
