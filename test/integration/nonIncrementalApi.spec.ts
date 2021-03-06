// tslint:disable:no-implicit-dependencies
import path from 'path';
import * as helpers from './helpers';
import webpack from 'webpack';

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: false', () => {
  let plugin: helpers.ForkTsCheckerWebpackPlugin;

  function createCompiler(
    options: Partial<helpers.CreateCompilerOptions> = {}
  ) {
    const compiler = helpers.createCompiler({
      ...options,
      pluginOptions: {
        ...options.pluginOptions,
        useTypescriptIncrementalApi: false
      }
    });
    plugin = compiler.plugin;
    return compiler.compiler;
  }

  it('should work without configuration', callback => {
    const compiler = createCompiler();

    compiler.run((err, stats) => {
      expect(stats.compilation.errors.length).toBeGreaterThanOrEqual(1);
      callback();
    });
  });

  it('should find the same errors on multi-process mode', async () => {
    const compilerA = createCompiler({
      pluginOptions: {
        workers: 1,
        tslint: true
      }
    });
    const compilerB = createCompiler({
      pluginOptions: {
        workers: 4,
        tslint: true
      }
    });

    const [a, b] = await Promise.all([
      new Promise<webpack.compilation.Compilation>(resolve =>
        compilerA.run((error, stats) => {
          resolve(stats.compilation);
        })
      ),
      new Promise<webpack.compilation.Compilation>(resolve =>
        compilerB.run((error, stats) => {
          resolve(stats.compilation);
        })
      )
    ]);

    expect(a.errors).toEqual(b.errors);
    expect(a.warnings).toEqual(b.warnings);
  });

  it('should only show errors matching paths specified in reportFiles when provided', callback => {
    const compiler = createCompiler({
      pluginOptions: {
        checkSyntacticErrors: true,
        reportFiles: ['**/index.ts']
      },
      happyPackMode: true
    });

    // this test doesn't make as much sense in the context of using the incremental API
    // as in that case the compiler will stop looking for further errors when it finds one
    // see https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/pull/198#issuecomment-453790649 for details
    compiler.run((error, stats) => {
      expect(stats.compilation.errors.length).toBe(1);
      expect(stats.compilation.errors[0]).toEqual(
        expect.objectContaining({ file: expect.stringMatching(/index.ts$/) })
      );
      callback();
    });
  });

  it('should handle errors within the IncrementalChecker gracefully as diagnostic', callback => {
    const compiler = createCompiler();
    plugin['nodeArgs'] = [
      `--require`,
      `${path.resolve(__dirname, './mocks/IncrementalCheckerWithError.js')}`
    ];

    compiler.run((error, stats) => {
      expect(stats.compilation.errors.length).toBe(1);
      expect(stats.compilation.errors[0]).toEqual(
        expect.objectContaining({
          message: expect.stringContaining("I'm an error!")
        })
      );
      callback();
    });
  });
});
