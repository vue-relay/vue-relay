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
yarn add --dev babel-plugin-relay
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
yarn add --dev relay-compiler
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

``` vue
<!-- Example.vue -->
<template>
  <query-renderer :environment="environment" :query="query" :variables="variables">
    <template slot-scope="{ props, error, retry }">
      <div v-if="error">{{ error.message }}</div>
      <div v-else-if="props">{{ props.page.name }} is great!</div>
      <div v-else>Loading</div>
    </template>
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

``` vue
<!-- TodoItem.vue -->
<template>
  <fragment-container>
    <template slot-scope="{ relay, item }">
      <div>
        <input type="checkbox" :checked="item.isComplete">
        <p>{{ item.text }}</p>
      </div>
    </template>
  </fragment-container>
</template>

<script>
import { createFragmentContainer, graphql } from 'vue-relay'

export default {
  name: 'todo-item',
  components: {
    FragmentContainer: createFragmentContainer(graphql`
      fragment TodoItem_item on Todo {
        text
        isComplete
      }
    `)
  }
}
</script>
```

``` vue
<!-- TodoList.vue -->
<template>
  <fragment-container>
    <template slot-scope="{ relay, list }">
      <div>
        <h3>{{ list.title }}</h3>
        <todo-item v-for="(item, index) in list.todoItems" :item="item" :key="index"></todo-item>
      </div>
    </template>
  </fragment-container>
</template>

<script>
import { createFragmentContainer, graphql } from 'vue-relay'
import TodoItem from './TodoItem'

export default {
  components: {
    TodoItem,
    FragmentContainer: createFragmentContainer(graphql`
      fragment TodoList_list on TodoList {
        title
        todoItems {
          ...TodoItem_item
        }
      }
    `)
  }
}
</script>
```

### Refetch Container

``` vue
<!-- TodoItem.vue -->
<template>
  <refetch-container>
    <template slot-scope="{ relay, item }">
      <div>
        <input type="checkbox" :checked="item.isComplete">
        <p>{{ item.text }}</p>
        <button @click="relay.refetch({ itemId: item.id }, null, () => { console.log('Refetch done') }, { force: true })"></button>
      </div>
    </template>
  </refetch-container>
</template>

<script>
import { createRefetchContainer, graphql } from 'vue-relay'

export default {
  name: 'todo-item',
  components: {
    RefetchContainer: createRefetchContainer(graphql`
      fragment TodoItem_item on Todo {
        text
        isComplete
      }
    `, graphql`
      # Refetch query to be fetched upon calling 'refetch()'.
      # Notice that we re-use our fragment and the shape of this query matches our fragment spec.
      query TodoItemRefetchQuery($itemID: ID!) {
        item: node(id: $itemID) {
          ...TodoItem_item
        }
      }
    `)
  }
}
</script>
```

### Pagination Container

``` vue
<!-- Feed.vue -->
<template>
  <pagination-container>
    <template slot-scope="{ relay, user }">
      <div>
        <story v-for="edge in user.feed.edges" :story="edge.node" :key="edge.node.id"></story>
        <button @click="relay.loadMore(10, error => { console.log(error) })">Load More</button>
      </div>
    </template>
  </pagination-container>
</template>

<script>
import { createPaginationContainer, graphql } from 'vue-relay'
import Story from './Story'

export default {
  name: 'feed',
  components: {
    Story,
    PaginationContainer: createPaginationContainer(graphql`
      fragment Feed_user on User
        @argumentDefinitions(
          count: {type: "Int", defaultValue: 10}
          cursor: {type: "ID"}
          orderby: {type: "[FriendsOrdering]", defaultValue: [DATE_ADDED]}
        ) {
          feed(
            first: $count
            after: $cursor
            orderby: $orderBy # Non-pagination variables
          ) @connection(key: "Feed_feed") {
            edges {
              node {
                id
                ...Story_story
              }
            }
          }
        }
      }
    `, {
      direction: 'forward',
      getConnectionFromProps (props) {
        return props.user && props.user.feed
      },
      // This is also the default implementation of `getFragmentVariables` if it isn't provided.
      getFragmentVariables (prevVars, totalCount) {
        return {
          ...prevVars,
          count: totalCount
        }
      },
      getVariables (props, { count, cursor }, fragmentVariables) {
        return {
          count,
          cursor,
          orderBy: fragmentVariables.orderBy,
          // userID isn't specified as an @argument for the fragment, but it should be a variable available for the fragment under the query root.
          userID: fragmentVariables.userID
        }
      },
      query: graphql`
        # Pagination query to be fetched upon calling loadMore().
        # Notice that we re-use our fragment, and the shape of this query matches our fragment spec.
        query FeedPaginationQuery(
          $count: Int!
          $cursor: ID
          $orderBy: [FriendsOrdering]!
          $userID: ID!
        ) {
          user: node(id: $userID) {
            ...Feed_user @arguments(count: $count, cursor: $cursor, orderBy: $orderBy)
          }
        }
      `
    })
  }
}
</script>
```

### Comparison with `react-relay`

- `QueryRenderer` does not take render function.
- Container creating functions do not take component as argument. The rest of function signature remains the same.

`vue-relay` replaces them with [scoped slots](https://vuejs.org/v2/guide/components.html#Scoped-Slots) in both cases.

### Other APIs

Other APIs are exactly same as Relay's Public APIs. Please refer to Relay's [documentation](https://facebook.github.io/relay/docs/en/introduction-to-relay.html).

---

## License

vue-relay is [BSD-2-Clause licensed](LICENSE).

Relay is [MIT licensed](https://github.com/facebook/relay/blob/master/LICENSE).
