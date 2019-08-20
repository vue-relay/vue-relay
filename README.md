# vue-relay

A framework for building GraphQL-driven Vue.js applications.

[![npm](https://img.shields.io/npm/v/vue-relay.svg)](https://www.npmjs.com/package/vue-relay)

## Introduction

### Installation and Setup

#### Installation

Install Vue and Relay using `yarn` or `npm`:

``` sh
yarn add vue vue-relay
```

#### Set up babel-plugin-relay

Relay Modern requires a Babel plugin to convert GraphQL to runtime artifacts:

``` sh
yarn add --dev babel-plugin-relay graphql
```

Add `"relay"` to the list of plugins your `.babelrc` file:

``` json
{
  "plugins": [
    "relay"
  ]
}
```

Please note that the "relay" plugin should run before other plugins or presets to ensure the `graphql` template literals are correctly transformed. See Babel's [documentation on this topic](https://babeljs.io/docs/plugins/#plugin-preset-ordering).

#### Set up relay-compiler

Relay's ahead-of-time compilation requires the [Relay Compiler](https://facebook.github.io/relay/docs/en/graphql-in-relay.html#relay-compiler.html), which you can install via `yarn` or `npm`:

``` sh
yarn add --dev relay-compiler graphql
```

This installs the bin script `relay-compiler` in your node_modules folder. It's recommended to run this from a `yarn/npm` script by adding a script to your `package.json` file:

``` json
"scripts": {
  "relay": "relay-compiler --src ./src --schema ./schema.graphql"
}
```

Then, after making edits to your application files, just run the `relay` script to generate new compiled artifacts:

``` sh
yarn run relay
```

**Note:** `relay-compiler` does not understand single-file components with a `.vue` extension. You can `export` `graphql` template literals in `.js` files, and then `import` them in `.vue` single-file components.

For more details, check out [Relay Compiler docs](https://facebook.github.io/relay/docs/en/graphql-in-relay.html#relay-compiler).

---

## API Reference

### \<QueryRenderer />

#### Props

- `environment`: The [Relay Environment](https://facebook.github.io/relay/docs/en/relay-environment.html)
- `query`: The graphql tagged query. **Note:** To [enable compatibility](https://facebook.github.io/relay/docs/en/relay-compat.html) mode, relay-compiler enforces the query to be named as `<FileName>Query`. Optional, if not provided, an empty props object is passed to the render callback.
- `variables`: Object containing set of variables to pass to the GraphQL query, i.e. a mapping from variable name to value. **Note:** If a new set of variables is passed, the QueryRenderer will re-fetch the query.

#### Scoped Slot Props

- `props`: Object containing data obtained from the query; the shape of this object will match the shape of the query. If this object is not defined, it means that the data is still being fetched.
- `error`: Error will be defined if an error has occurred while fetching the query.
- `retry`: Reload the data. It is null if `query` was not provided.

#### Example

``` vue
<!-- Example.vue -->
<template>
  <query-renderer :environment="environment" :query="query" :variables="variables" v-slot="{ props, error, retry }">
    <div v-if="error">{{ error.message }}</div>
    <div v-else-if="props">{{ props.page.name }} is great!</div>
    <div v-else>Loading</div>
  </query-renderer>
</template>

<script>
import { QueryRenderer, graphql } from 'vue-relay'

export default {
  name: 'example',
  components: {
    QueryRenderer
  },
  data () {
    return {
      environment: ..., // https://facebook.github.io/relay/docs/en/relay-environment.html
      query: graphql`
        query ExampleQuery($pageID: ID!) {
          page(id: $pageID) {
            name
          }
        }
      `,
      variables: {
        pageID: '110798995619330'
      }
    }
  }
}
</script>
```

### Fragment Container

``` javascript
createFragmentContainer([component, ]fragmentSpec)
```

#### Props

- fragments as specified by the fragmentSpec

#### Component / Scoped Slot Props

``` javascript
{
  relay: {
    environment,
  },
  // Additional props as specified by the fragmentSpec
}
```


### Refetch Container

``` javascript
createRefetchContainer([component, ]fragmentSpec, refetchQuery)
```

#### Props

- fragments as specified by the fragmentSpec

#### Component / Scoped Slot Props

``` javascript
{
  relay: {
    environment,
    refetch(),
  },
  // Additional props as specified by the fragmentSpec
}
```

### Pagination Container

``` javascript
createPaginationContainer([component, ]fragmentSpec, connectionConfig)
```

#### Props

- fragments as specified by the fragmentSpec

#### Component / Scoped Slot Props

``` javascript
{
  relay: {
    environment,
    hasMore(),
    isLoading(),
    loadMore(),
    refetchConnection()
  },
  // Additional props as specified by the fragmentSpec
}
```

### Comparison with `react-relay`

- `QueryRenderer` does not take render function.
  - `vue-relay` replaces it with [scoped slots](https://vuejs.org/v2/guide/components.html#Scoped-Slots).
- Container creating functions take `component` as an optional argument.
  - If provided, a conatiner will pass props to the given `component`.
  - If ommited, a conatiner will pass props to its default scoped slot.

### Other APIs

Other APIs are exactly same as Relay's Public APIs. Please refer to Relay's [documentation](https://facebook.github.io/relay/docs/en/introduction-to-relay.html).

---

## Example

The [vue-relay-examples](https://github.com/ntkme/vue-relay-examples) repository contains an implementation of [TodoMVC](http://todomvc.com/). To try it out:

``` sh
git clone https://github.com/ntkme/vue-relay-examples.git
cd vue-relay-examples/todo
npm install
npm run build
npm start
```

---

## License

vue-relay is [BSD-2-Clause licensed](LICENSE).

Relay is [MIT licensed](https://github.com/facebook/relay/blob/master/LICENSE).
