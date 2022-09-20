# node-sea

This project is an experiment built in the context of the Node.js [SEA project](https://github.com/nodejs/single-executable/), which aims to find a way to distribute Node.js packages as single executable archives.

**For this project to work, you must use a modern version of Node.js** - specifically, https://github.com/nodejs/node/pull/44537 must be merged. On 2022-09-20, no release has been made containing this change, so you'll need to build Node.js yourself from its `main` branch.

## Install

Install the `sea` binary globally:

```
npm install -g node-sea
```

Or to your project via:

```
yarn add node-sea
```

## Usage

Calling the `sea` binary will generate a single JS file (`a.cjs` by default, although this name can be changed with `-o,--output`) which, when run on the CLI, will call the binary selected via the `-b,--binary` option and, when required, will re-export the exports from the module selected via the `-m,--main` option.

In order to set the content of the binary you can mix the `-i,--input` flag, which takes a tgz to use as initial content, and the `-c,--command` flag, which runs a given command on the content to generate any extraneous files (for example, `-i ./pkg.tgz -c 'yarn install'` would store both `./pkg.tgz` and its dependencies).

## Examples

Packing a package:

```
yarn sea -c 'yarn init -y && yarn add prettier' -b prettier -m prettier
```

Packing a couple of packages together:

```
yarn sea -c 'yarn init -y && yarn add webpack webpack-cli' -b webpack-cli -m webpack
```

Packing a tgz:

```
wget https://registry.yarnpkg.com/typescript/-/typescript-4.8.3.tgz
yarn sea -i ./typescript-4.8.3.tgz -b ./:tsc
```

Packing a tgz after installing its dependencies:

```
wget https://registry.yarnpkg.com/http-server/-/http-server-14.1.1.tgz
yarn sea -i ./http-server-14.1.1.tgz -c 'yarn install' -b ./
```

## Limitations

- Workers will only work once https://github.com/nodejs/node/pull/44732 is merged; for instance, running Webpack from a SEA application will crash because it starts a worker that doesn't know how to access the virtual files.

- Native modules aren't supported yet; I want to implement them by putting them aside the generated file and replacing them by symlinks within the packed application.
