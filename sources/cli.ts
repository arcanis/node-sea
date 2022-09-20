#!/usr/bin/env node

import {CwdFS, FakeFS, Filename, npath, PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import {ZipFS}                                                    from '@yarnpkg/libzip';
import {spawn}                                                    from 'child_process';
import {Command, Option, runExit, UsageError}                     from 'clipanion';
import * as t                                                     from 'typanion';

import {extractArchiveTo}                                         from './tools/convertToZip';

const isModuleLocator = t.cascade(t.isString(), [t.matchesRegExp(/^[^:]+(:[^:]+)?$/)]);

async function isDirectory(path: PortablePath) {
  try {
    const stat = await xfs.statPromise(path);
    return stat.isDirectory();
  } catch (err) {
    if (err.code === `ENOENT`) {
      return false;
    } else {
      throw err;
    }
  }
}

class PackCommand extends Command {
  input = Option.String(`-i,--input`, {
    description: `Path of the .tgz archive which will be turned into a SEA executable`,
  });

  install = Option.String(`-c,--install-command`, {
    description: `If set, the specified command will run on the given archive before generating the SEA archive`,
  });

  output = Option.String(`-o,--output`, {
    description: `The location where to store the resulting SEA executable`,
  });

  binary = Option.String(`-b,--bin`, {
    description: `Name of the binary that must be called when executing the SEA archive`,
    validator: isModuleLocator,
  });

  main = Option.String(`-m,--main`, {
    description: `Name of the module that must be forwarded when requiring the SEA archive`,
    validator: isModuleLocator,
  });

  async execute() {
    const input = typeof this.input !== `undefined`
      ? await xfs.readFilePromise(npath.toPortablePath(this.input))
      : undefined;

    const zipFs = await this.generateZipArchive(input);
    const seaFile = await this.generateSeaFile(zipFs);

    let outputPath = npath.toPortablePath(this.output ?? `./`);
    if (outputPath.endsWith(`/`) || await isDirectory(outputPath))
      outputPath = ppath.join(outputPath, `a` as Filename);
    if (!ppath.extname(outputPath))
      outputPath = `${outputPath}.cjs` as PortablePath;

    await xfs.writeFilePromise(outputPath, seaFile);
  }

  async generateZipArchive(input: Buffer | undefined) {
    const zipFs = new ZipFS();
    const prefixPath = `package` as PortablePath;

    const install = this.install;
    if (typeof install === `undefined`) {
      if (typeof input !== `undefined`)
        await extractArchiveTo(input, zipFs, {stripComponents: 1, prefixPath});


      return zipFs;
    }

    await xfs.mktempPromise(async tempDir => {
      const pkgFolder = ppath.join(tempDir, prefixPath);

      await xfs.mkdirPromise(pkgFolder);
      const targetFs = new CwdFS(pkgFolder);

      // 1. Extract the tgz into a temporary folder
      if (typeof input !== `undefined`)
        await extractArchiveTo(input, targetFs, {stripComponents: 1});

      // 2. Remove the development dependencies and scripts; we only care about installing dependencies
      const data = await this.openManifest(targetFs);

      delete data.devDependencies;
      delete data.scripts;

      await targetFs.writeJsonPromise(Filename.manifest, data);

      // 3. Run the install command there
      const child = spawn(install, [], {
        cwd: npath.fromPortablePath(pkgFolder),
        shell: true,
        stdio: `inherit`,
        env: {
          ...process.env,
          // This node-sea prototype only deals with node_modules for now, since
          // that's the common denominator between all three package managers
          YARN_NODE_LINKER: `node-modules`,
        },
      });

      const result = await new Promise<number>((resolve, reject) => {
        child.on(`close`, (code, signal) => resolve(code ?? 1));
      });

      if (result !== 0)
        throw new UsageError(`Command failed`);

      // 4. Pack the resulting folder into the zip archive
      await zipFs.copyPromise(PortablePath.root, tempDir, {baseFs: xfs});
    });

    return zipFs;
  }

  async generateSeaFile(zipFs: ZipFS) {
    const zipData = zipFs.getBufferAndClose();

    const templatePath = npath.toPortablePath(require.resolve(`../template`));
    const templateContent = await xfs.readFilePromise(templatePath, `utf8`);

    const templatePrefix = `"use strict";var parameters=${JSON.stringify({
      data: zipData.toString(`base64`),
      main: this.main?.split(`:`),
      bin: this.binary?.split(`:`),
    })};\n`;

    return templatePrefix + templateContent;
  }

  async openManifest(targetFs: FakeFS<PortablePath>, p: PortablePath = PortablePath.dot) {
    let data: any;
    try {
      data = await targetFs.readJsonPromise(ppath.join(p, Filename.manifest));
    } catch {}

    return data ?? {};
  }
}

runExit({
  binaryLabel: ``,
}, [
  PackCommand,
]);
