import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'

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
  external: [
    'fbjs/lib/areEqual',
    'fbjs/lib/forEachObject',
    'fbjs/lib/invariant',
    'fbjs/lib/mapObject',
    'fbjs/lib/warning',
    'relay-runtime',
    'vue'
  ],
  plugins: [
    babel(),
    ...(config.env
      ? [replace({ 'process.env.NODE_ENV': JSON.stringify(config.env) })]
      : [])
  ]
}))
