import ts      from '@rollup/plugin-typescript';
import shebang from 'rollup-plugin-preserve-shebang';

// eslint-disable-next-line arca/no-default-export
export default {
  input: `./sources/cli.ts`,
  output: [
    {
      dir: `lib`,
      entryFileNames: `[name].mjs`,
      format: `es`,
    },
    {
      dir: `lib`,
      entryFileNames: `[name].js`,
      format: `cjs`,
    },
  ],
  plugins: [
    shebang(),
    ts({
      tsconfig: `tsconfig.build.json`,
    }),
  ],
};
