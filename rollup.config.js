import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'
import uglify from 'rollup-plugin-uglify'

const version = process.env.VERSION || require('./package.json').version
const banner =
`/**
 * vue-relay v${version}
 * (c) ${new Date().getFullYear()} なつき
 * @license BSD-2-Clause
 */`

export default [
  {
    input: 'src/index.js',
    output: {
      format: 'umd',
      file: 'dist/vue-relay.js'
    },
    env: 'development'
  },
  {
    input: 'src/index.js',
    output: {
      format: 'umd',
      file: 'dist/vue-relay.min.js'
    },
    env: 'production'
  },
  {
    input: 'src/index.js',
    output: {
      file: 'dist/vue-relay.common.js',
      format: 'cjs'
    }
  },
  {
    input: 'src/index.esm.js',
    output: {
      file: 'dist/vue-relay.esm.js',
      format: 'es'
    }
  }
].map(config => ({
  input: config.input,
  output: Object.assign(config.output, {
    banner,
    name: 'vue-relay'
  }),
  plugins: [
    babel(),
    ...(config.env
      ? [replace({ 'process.env.NODE_ENV': JSON.stringify(config.env) })]
      : []),
    ...(/\.min\.js$/.test(config.output.file)
      ? [uglify()]
      : [])
  ]
}))
