const path = require('path');
const { readFileSync } = require('fs');
const { yamlParse } = require('yaml-cfn');

const conf = {
  prodMode: process.env.NODE_ENV === 'production',
  templatePath: './template.yml',
};
const cfn = yamlParse(readFileSync(conf.templatePath));
const entries = Object.values(cfn.Resources)
  // Find nodejs functions
  .filter(v => v.Type === 'AWS::Serverless::Function')
  .filter(v =>
    (v.Properties.Runtime && v.Properties.Runtime.startsWith('nodejs')) ||
    (!v.Properties.Runtime && cfn.Globals.Function.Runtime)
  )
  .map(v => ({
    // Isolate handler src filename
    handlerFile: v.Properties.Handler.split('.')[0],
    // Build handler dst path
    // CodeUriDir: v.Properties.CodeUri.split('/').splice(2).join('/')
  }))
  .reduce(
    (entries, v) =>
      Object.assign(
        entries,
        // Generate {outputPath: inputPath} object
        {[`${v.handlerFile}`]: ['./source-map-install.js', `./${v.handlerFile}.ts`]}
      ),
      {}
  );


module.exports = {
  mode: conf.prodMode ? 'production' : 'development',
  entry: entries,
  devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
  },
  target: 'node',
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: 'ts-loader' },
    ],
  },
};
