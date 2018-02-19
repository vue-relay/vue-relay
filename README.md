# vue-relay

A framework for building GraphQL-driven Vue.js applications.

## API Reference

#### \<QueryRenderer />

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

#### Fragment Container

``` vue
<!-- TodoItem.vue -->
<template>
  <fragment-container>
    <template slot-scope="{ relay, item }">
      <div>
        <input type="checkbox" :checked="item.isComplete}"></input>
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
        <todo-item v-for="item in list.todoItems" :item="item"></todo-item>
      </div>
    </template>
  </fragment-container>
</template>

<script>
import { createFragmentContainer, graphql } from 'vue-relay'
import TodoItem from './TodoItem'

export default {
  components: {
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

#### Refetch Container

``` vue
<!-- TodoItem.vue -->
<template>
  <refetch-container>
    <template slot-scope="{ relay, item }">
      <div>
        <input type="checkbox" :checked="item.isComplete}"></input>
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
      # Refetch query to be fetched upon calling `refetch`.
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

#### Pagination Container

``` vue
<!-- Feed.vue -->
<template>
  <pagination-container>
    <template slot-scope="{ relay, user }">
      <div>
        <story v-for="story in user.feed.edges" :story="edge.node" :key="edge.node.id"></story>
        <button @click="relay.loadMore()">Load More</button>
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
      getConnectionFromProps(props) {
        return props.user && props.user.feed
      },
      // This is also the default implementation of `getFragmentVariables` if it isn't provided.
      getFragmentVariables(prevVars, totalCount) {
        return {
          ...prevVars,
          count: totalCount
        }
      },
      getVariables(props, {count, cursor}, fragmentVariables) {
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

## License

vue-relay is [BSD-2-Clause licensed](LICENSE).

Relay is [MIT licensed](https://github.com/facebook/relay/blob/master/LICENSE).