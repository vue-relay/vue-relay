/**
 * vue-relay v5.1.0
 * (c) 2020 なつき
 * @license BSD-2-Clause
 */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Vue = _interopDefault(require('vue'));
var invariant = _interopDefault(require('fbjs/lib/invariant'));
var relayRuntime = require('relay-runtime');
var mapObject = _interopDefault(require('fbjs/lib/mapObject'));
var areEqual = _interopDefault(require('fbjs/lib/areEqual'));
var forEachObject = _interopDefault(require('fbjs/lib/forEachObject'));
var warning = _interopDefault(require('fbjs/lib/warning'));

function _typeof(obj) {
  "@babel/helpers - typeof";

  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function (obj) {
      return typeof obj;
    };
  } else {
    _typeof = function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

var fetchQuery = relayRuntime.__internal.fetchQuery;

var VueRelayQueryFetcher = /*#__PURE__*/function () {
  function VueRelayQueryFetcher(args) {
    _classCallCheck(this, VueRelayQueryFetcher);

    // this._fetchOptions
    // this._pendingRequest
    // this._rootSubscription
    this._selectionReferences = []; // this._snapshot
    // this._error
    // this._cacheSelectionReference

    this._callOnDataChangeWhenSet = false;

    if (args != null) {
      this._cacheSelectionReference = args.cacheSelectionReference;
      this._selectionReferences = args.selectionReferences;
    }
  }

  _createClass(VueRelayQueryFetcher, [{
    key: "getSelectionReferences",
    value: function getSelectionReferences() {
      return {
        cacheSelectionReference: this._cacheSelectionReference,
        selectionReferences: this._selectionReferences
      };
    }
  }, {
    key: "lookupInStore",
    value: function lookupInStore(environment, operation) {
      if (environment.check(operation)) {
        this._retainCachedOperation(environment, operation);

        return environment.lookup(operation.fragment, operation);
      }

      return null;
    }
  }, {
    key: "execute",
    value: function execute(_ref) {
      var _this = this;

      var environment = _ref.environment,
          operation = _ref.operation,
          cacheConfig = _ref.cacheConfig,
          _ref$preservePrevious = _ref.preservePreviousReferences,
          preservePreviousReferences = _ref$preservePrevious === void 0 ? false : _ref$preservePrevious;
      var reference = environment.retain(operation);
      var fetchQueryOptions = cacheConfig != null ? {
        networkCacheConfig: cacheConfig
      } : {};

      var error = function error() {
        // We may have partially fulfilled the request, so let the next request
        // or the unmount dispose of the references.
        _this._selectionReferences = _this._selectionReferences.concat(reference);
      };

      var complete = function complete() {
        if (!preservePreviousReferences) {
          _this.disposeSelectionReferences();
        }

        _this._selectionReferences = _this._selectionReferences.concat(reference);
      };

      var unsubscribe = function unsubscribe() {
        // Let the next request or the unmount code dispose of the references.
        // We may have partially fulfilled the request.
        _this._selectionReferences = _this._selectionReferences.concat(reference);
      };

      if (!relayRuntime.isRelayModernEnvironment(environment)) {
        return environment.execute({
          operation: operation,
          cacheConfig: cacheConfig
        })["do"]({
          error: error,
          complete: complete,
          unsubscribe: unsubscribe
        });
      }

      return fetchQuery(environment, operation, fetchQueryOptions)["do"]({
        error: error,
        complete: complete,
        unsubscribe: unsubscribe
      });
    }
  }, {
    key: "setOnDataChange",
    value: function setOnDataChange(onDataChange) {
      invariant(this._fetchOptions, 'VueRelayQueryFetcher: `setOnDataChange` should have been called after having called `fetch`');

      if (typeof onDataChange === 'function') {
        // Mutate the most recent fetchOptions in place,
        // So that in-progress requests can access the updated callback.
        this._fetchOptions.onDataChangeCallbacks = this._fetchOptions.onDataChangeCallbacks || [];

        this._fetchOptions.onDataChangeCallbacks.push(onDataChange);

        if (this._callOnDataChangeWhenSet) {
          // We don't reset '_callOnDataChangeWhenSet' because another callback may be set
          if (this._error != null) {
            onDataChange({
              error: this._error
            });
          } else if (this._snapshot != null) {
            onDataChange({
              snapshot: this._snapshot
            });
          }
        }
      }
    }
    /**
     * `fetch` fetches the data for the given operation.
     * If a result is immediately available synchronously, it will be synchronously
     * returned by this function.
     *
     * Otherwise, the fetched result will be communicated via the `onDataChange` callback.
     * `onDataChange` will be called with the first result (**if it wasn't returned synchronously**),
     * and then subsequently whenever the data changes.
     */

  }, {
    key: "fetch",
    value: function fetch(fetchOptions) {
      var _this2 = this;

      var cacheConfig = fetchOptions.cacheConfig,
          environment = fetchOptions.environment,
          operation = fetchOptions.operation,
          onDataChange = fetchOptions.onDataChange;
      var fetchHasReturned = false;

      var _error;

      this.disposeRequest();
      var oldOnDataChangeCallbacks = this._fetchOptions && this._fetchOptions.onDataChangeCallbacks;
      this._fetchOptions = {
        cacheConfig: cacheConfig,
        environment: environment,
        onDataChangeCallbacks: oldOnDataChangeCallbacks || [],
        operation: operation
      };

      if (onDataChange && this._fetchOptions.onDataChangeCallbacks.indexOf(onDataChange) === -1) {
        this._fetchOptions.onDataChangeCallbacks.push(onDataChange);
      }

      var request = this.execute({
        environment: environment,
        operation: operation,
        cacheConfig: cacheConfig
      })["finally"](function () {
        _this2._pendingRequest = null;
      }).subscribe({
        next: function next() {
          // If we received a response,
          // Make a note that to notify the callback when it's later added.
          _this2._callOnDataChangeWhenSet = true;
          _this2._error = null; // Only notify of the first result if `next` is being called **asynchronously**
          // (i.e. after `fetch` has returned).

          _this2._onQueryDataAvailable({
            notifyFirstResult: fetchHasReturned
          });
        },
        error: function error(err) {
          // If we received a response when we didn't have a change callback,
          // Make a note that to notify the callback when it's later added.
          _this2._callOnDataChangeWhenSet = true;
          _this2._error = err;
          _this2._snapshot = null;
          var onDataChangeCallbacks = _this2._fetchOptions && _this2._fetchOptions.onDataChangeCallbacks; // Only notify of error if `error` is being called **asynchronously**
          // (i.e. after `fetch` has returned).

          if (fetchHasReturned) {
            if (onDataChangeCallbacks) {
              onDataChangeCallbacks.forEach(function (onDataChange) {
                onDataChange({
                  error: err
                });
              });
            }
          } else {
            _error = err;
          }
        }
      });
      this._pendingRequest = {
        dispose: function dispose() {
          request.unsubscribe();
        }
      };
      fetchHasReturned = true;

      if (_error) {
        throw _error;
      }

      return this._snapshot;
    }
  }, {
    key: "retry",
    value: function retry() {
      invariant(this._fetchOptions, 'VueRelayQueryFetcher: `retry` should be called after having called `fetch`');
      return this.fetch({
        cacheConfig: this._fetchOptions.cacheConfig,
        environment: this._fetchOptions.environment,
        operation: this._fetchOptions.operation,
        onDataChange: null // If there are onDataChangeCallbacks they will be reused

      });
    }
  }, {
    key: "dispose",
    value: function dispose() {
      this.disposeRequest();
      this.disposeSelectionReferences();
    }
  }, {
    key: "disposeRequest",
    value: function disposeRequest() {
      this._error = null;
      this._snapshot = null; // order is important, dispose of pendingFetch before selectionReferences

      if (this._pendingRequest) {
        this._pendingRequest.dispose();
      }

      if (this._rootSubscription) {
        this._rootSubscription.dispose();

        this._rootSubscription = null;
      }
    }
  }, {
    key: "_retainCachedOperation",
    value: function _retainCachedOperation(environment, operation) {
      this._disposeCacheSelectionReference();

      this._cacheSelectionReference = environment.retain(operation);
    }
  }, {
    key: "_disposeCacheSelectionReference",
    value: function _disposeCacheSelectionReference() {
      this._cacheSelectionReference && this._cacheSelectionReference.dispose();
      this._cacheSelectionReference = null;
    }
  }, {
    key: "disposeSelectionReferences",
    value: function disposeSelectionReferences() {
      this._disposeCacheSelectionReference();

      this._selectionReferences.forEach(function (r) {
        return r.dispose();
      });

      this._selectionReferences = [];
    }
  }, {
    key: "_onQueryDataAvailable",
    value: function _onQueryDataAvailable(_ref2) {
      var _this3 = this;

      var notifyFirstResult = _ref2.notifyFirstResult;
      invariant(this._fetchOptions, 'VueRelayQueryFetcher: `_onQueryDataAvailable` should have been called after having called `fetch`');
      var _this$_fetchOptions = this._fetchOptions,
          environment = _this$_fetchOptions.environment,
          onDataChangeCallbacks = _this$_fetchOptions.onDataChangeCallbacks,
          operation = _this$_fetchOptions.operation; // `_onQueryDataAvailable` can be called synchronously the first time and can be called
      // multiple times by network layers that support data subscriptions.
      // Wait until the first payload to call `onDataChange` and subscribe for data updates.

      if (this._snapshot) {
        return;
      }

      this._snapshot = environment.lookup(operation.fragment, operation); // Subscribe to changes in the data of the root fragment

      this._rootSubscription = environment.subscribe(this._snapshot, function (snapshot) {
        // Read from this._fetchOptions in case onDataChange() was lazily added.
        if (_this3._fetchOptions != null) {
          var maybeNewOnDataChangeCallbacks = _this3._fetchOptions.onDataChangeCallbacks;

          if (Array.isArray(maybeNewOnDataChangeCallbacks)) {
            maybeNewOnDataChangeCallbacks.forEach(function (onDataChange) {
              return onDataChange({
                snapshot: snapshot
              });
            });
          }
        }
      });

      if (this._snapshot && notifyFirstResult && Array.isArray(onDataChangeCallbacks)) {
        var snapshot = this._snapshot;
        onDataChangeCallbacks.forEach(function (onDataChange) {
          return onDataChange({
            snapshot: snapshot
          });
        });
      }
    }
  }]);

  return VueRelayQueryFetcher;
}();

/**
 * Fail fast if the user supplies invalid fragments as input.
 */

function assertFragmentMap(componentName, fragmentSpec) {
  invariant(fragmentSpec && _typeof(fragmentSpec) === 'object', 'Could not create Relay Container for `%s`. ' + 'Expected a set of GraphQL fragments, got `%s` instead.', componentName, fragmentSpec);

  for (var key in fragmentSpec) {
    if (fragmentSpec.hasOwnProperty(key)) {
      var fragment = fragmentSpec[key];
      invariant(fragment && (_typeof(fragment) === 'object' || typeof fragment === 'function'), 'Could not create Relay Container for `%s`. ' + 'The value of fragment `%s` was expected to be a fragment, got `%s` instead.', componentName, key, fragment);
    }
  }
}

function getComponentName(component) {
  return component ? component.name || 'component' : 'slot';
}

function getContainerName(component) {
  return 'relay-' + getComponentName(component);
}

var VUE_RELAY_PROPS = 'vue-relay-props';

var buildVueRelayContainer = function buildVueRelayContainer(component, fragmentSpec, createContainerWithFragments) {
  // Sanity-check user-defined fragment input
  assertFragmentMap(getComponentName(component), fragmentSpec);
  var fragments = mapObject(fragmentSpec, relayRuntime.getFragment);
  var props = Object.keys(fragments);
  return {
    "extends": createContainerWithFragments(component, fragments),
    props: props,
    methods: {
      applyDerivedStateFromProps: function applyDerivedStateFromProps() {
        this.setState(this.getDerivedStateFromProps(_objectSpread2(_objectSpread2({}, this.$props), this.props), this.state));
      },
      setState: function setState(partialState, callback) {
        var _this = this;

        if (typeof partialState === 'function') {
          partialState = partialState(_objectSpread2({}, this.state));
        }

        if (partialState != null) {
          var prevState = this.state;

          var nextState = _objectSpread2(_objectSpread2({}, prevState), partialState);

          var prevProps = _objectSpread2(_objectSpread2({}, this.$props), this.props);

          var forceUpdate = this.shouldComponentUpdate(prevProps, nextState);
          this.state = nextState;

          if (typeof callback === 'function') {
            callback();
          }

          if (forceUpdate) {
            this.$nextTick(function () {
              _this.componentDidUpdate(prevProps, prevState);
            });
            this.$forceUpdate();
          }
        }
      }
    },
    watch: _objectSpread2({
      'props.__relayContext': 'applyDerivedStateFromProps'
    }, props.map(function (prop) {
      return _defineProperty({}, prop, 'applyDerivedStateFromProps');
    })),
    render: function render(h) {
      if (this.state.contextForChildren != null) {
        this[VUE_RELAY_PROPS].__relayContext = Object.freeze(_objectSpread2({}, this.state.contextForChildren));
      }

      if (component != null) {
        return h(component, {
          props: _objectSpread2(_objectSpread2(_objectSpread2({}, this.$attrs), this.state.data), {}, {
            relay: this.state.relayProp
          })
        });
      }

      return h('keep-alive', {
        props: {
          include: []
        }
      }, this.$scopedSlots["default"](_objectSpread2(_objectSpread2({}, this.state.data), {}, {
        relay: this.state.relayProp
      })));
    },
    inject: {
      'props': {
        from: VUE_RELAY_PROPS
      }
    },
    provide: function provide() {
      return this.state.contextForChildren != null ? _defineProperty({}, VUE_RELAY_PROPS, this[VUE_RELAY_PROPS] = Vue.observable({
        __relayContext: Object.freeze(_objectSpread2({}, this.state.contextForChildren))
      })) : {};
    }
  };
};

var requestCache = {};
var NETWORK_ONLY = 'NETWORK_ONLY';
var STORE_THEN_NETWORK = 'STORE_THEN_NETWORK';
var DataFromEnum = {
  NETWORK_ONLY: NETWORK_ONLY,
  STORE_THEN_NETWORK: STORE_THEN_NETWORK
};
var VueRelayQueryRenderer = {
  name: 'relay-query-renderer',
  props: {
    cacheConfig: {
      type: Object
    },
    dataFrom: {
      type: String,
      validator: function validator(val) {
        return Object.values(DataFromEnum).indexOf(val) !== -1;
      }
    },
    environment: {
      type: Object,
      required: true
    },
    query: {},
    variables: {
      type: Object,
      "default": function _default() {
        return {};
      }
    }
  },
  data: function data() {
    // Callbacks are attached to the current instance and shared with static
    // lifecyles by bundling with state. This is okay to do because the
    // callbacks don't change in reaction to props. However we should not
    // "leak" them before mounting (since we would be unable to clean up). For
    // that reason, we define them as null initially and fill them in after
    // mounting to avoid leaking memory.
    var retryCallbacks = {
      handleDataChange: null,
      handleRetryAfterError: null
    };
    var queryFetcher;
    var requestCacheKey;

    if (this.query) {
      var query = this.query;
      var request = relayRuntime.getRequest(query);
      requestCacheKey = getRequestCacheKey(request.params, this.variables);
      queryFetcher = requestCache[requestCacheKey] ? requestCache[requestCacheKey].queryFetcher : new VueRelayQueryFetcher();
    } else {
      queryFetcher = new VueRelayQueryFetcher();
    }

    this.state = _objectSpread2({
      prevPropsEnvironment: this.environment,
      prevPropsVariables: this.variables,
      prevQuery: this.query,
      queryFetcher: queryFetcher,
      retryCallbacks: retryCallbacks
    }, fetchQueryAndComputeStateFromProps(this.$props, queryFetcher, retryCallbacks, requestCacheKey));
    return {};
  },
  methods: {
    applyDerivedStateFromProps: function applyDerivedStateFromProps() {
      this.setState(this.getDerivedStateFromProps(this.$props, this.state));
    },
    setState: function setState(partialState) {
      if (typeof partialState === 'function') {
        partialState = partialState(_objectSpread2({}, this.state));
      }

      if (partialState != null) {
        var nextState = _objectSpread2(_objectSpread2({}, this.state), partialState);

        var forceUpdate = this.shouldComponentUpdate(this.$props, nextState);
        this.state = nextState;

        if (forceUpdate) {
          this.$forceUpdate();
        }
      }
    },
    getDerivedStateFromProps: function getDerivedStateFromProps(nextProps, prevState) {
      if (prevState.prevQuery !== nextProps.query || prevState.prevPropsEnvironment !== nextProps.environment || !areEqual(prevState.prevPropsVariables, nextProps.variables)) {
        var query = nextProps.query;
        var prevSelectionReferences = prevState.queryFetcher.getSelectionReferences();
        prevState.queryFetcher.disposeRequest();
        var queryFetcher;

        if (query) {
          var request = relayRuntime.getRequest(query);
          var requestCacheKey = getRequestCacheKey(request.params, nextProps.variables);
          queryFetcher = requestCache[requestCacheKey] ? requestCache[requestCacheKey].queryFetcher : new VueRelayQueryFetcher(prevSelectionReferences);
        } else {
          queryFetcher = new VueRelayQueryFetcher(prevSelectionReferences);
        }

        return _objectSpread2({
          prevQuery: nextProps.query,
          prevPropsEnvironment: nextProps.environment,
          prevPropsVariables: nextProps.variables,
          queryFetcher: queryFetcher
        }, fetchQueryAndComputeStateFromProps(nextProps, queryFetcher, prevState.retryCallbacks // passing no requestCacheKey will cause it to be recalculated internally
        // and we want the updated requestCacheKey, since variables may have changed
        ));
      }

      return null;
    },
    shouldComponentUpdate: function shouldComponentUpdate(_, nextState) {
      return nextState.renderProps !== this.state.renderProps;
    }
  },
  watch: {
    environment: 'applyDerivedStateFromProps',
    query: 'applyDerivedStateFromProps',
    variables: {
      handler: 'applyDerivedStateFromProps',
      deep: true
    }
  },
  render: function render(h) {
    var _this$state = this.state,
        renderProps = _this$state.renderProps,
        relayContext = _this$state.relayContext; // Note that the root fragment results in `renderProps.props` is already
    // frozen by the store; this call is to freeze the renderProps object and
    // error property if set.

    if (process.env.NODE_ENV !== 'production') {
      relayRuntime.deepFreeze(renderProps);
    }

    this[VUE_RELAY_PROPS].__relayContext = Object.freeze(_objectSpread2({}, relayContext));
    return h('keep-alive', {
      props: {
        include: []
      }
    }, this.$scopedSlots["default"](renderProps));
  },
  mounted: function mounted() {
    var _this = this;

    var _this$state2 = this.state,
        retryCallbacks = _this$state2.retryCallbacks,
        queryFetcher = _this$state2.queryFetcher,
        requestCacheKey = _this$state2.requestCacheKey;

    if (requestCacheKey) {
      delete requestCache[requestCacheKey];
    }

    retryCallbacks.handleDataChange = function (params) {
      var error = params.error == null ? null : params.error;
      var snapshot = params.snapshot == null ? null : params.snapshot;

      _this.setState(function (prevState) {
        var prevRequestCacheKey = prevState.requestCacheKey;

        if (prevRequestCacheKey) {
          delete requestCache[prevRequestCacheKey];
        } // Don't update state if nothing has changed.


        if (snapshot === prevState.snapshot && error === prevState.error) {
          return null;
        }

        return {
          renderProps: getRenderProps(error, snapshot, prevState.queryFetcher, prevState.retryCallbacks),
          snapshot: snapshot,
          requestCacheKey: null
        };
      });
    };

    retryCallbacks.handleRetryAfterError = function (_) {
      return _this.setState(function (prevState) {
        var prevRequestCacheKey = prevState.requestCacheKey;

        if (prevRequestCacheKey) {
          delete requestCache[prevRequestCacheKey];
        }

        return {
          renderProps: getLoadingRenderProps(),
          requestCacheKey: null
        };
      });
    }; // Re-initialize the VueRelayQueryFetcher with callbacks.
    // If data has changed since constructions, this will re-render.


    if (this.$props.query) {
      queryFetcher.setOnDataChange(retryCallbacks.handleDataChange);
    }
  },
  updated: function updated() {
    // We don't need to cache the request after the component commits
    var requestCacheKey = this.state.requestCacheKey;

    if (requestCacheKey) {
      delete requestCache[requestCacheKey]; // HACK

      delete this.state.requestCacheKey;
    }
  },
  beforeDestroy: function beforeDestroy() {
    this.state.queryFetcher.dispose();
  },
  provide: function provide() {
    return _defineProperty({}, VUE_RELAY_PROPS, this[VUE_RELAY_PROPS] = Vue.observable({
      __relayContext: Object.freeze(_objectSpread2({}, this.state.relayContext))
    }));
  }
};

function getContext(environment, variables) {
  return {
    environment: environment,
    variables: variables
  };
}

function getLoadingRenderProps() {
  return {
    error: null,
    props: null,
    // `props: null` indicates that the data is being fetched (i.e. loading)
    retry: null
  };
}

function getEmptyRenderProps() {
  return {
    error: null,
    props: {},
    // `props: {}` indicates no data available
    retry: null
  };
}

function getRenderProps(error, snapshot, queryFetcher, retryCallbacks) {
  return {
    error: error || null,
    props: snapshot ? snapshot.data : null,
    retry: function retry() {
      var syncSnapshot = queryFetcher.retry();

      if (syncSnapshot && typeof retryCallbacks.handleDataChange === 'function') {
        retryCallbacks.handleDataChange({
          snapshot: syncSnapshot
        });
      } else if (error && typeof retryCallbacks.handleRetryAfterError === 'function') {
        // If retrying after an error and no synchronous result available,
        // reset the render props
        retryCallbacks.handleRetryAfterError(error);
      }
    }
  };
}

function getRequestCacheKey(request, variables) {
  var requestID = request.id || request.text;
  return JSON.stringify({
    id: String(requestID),
    variables: variables
  });
}

function fetchQueryAndComputeStateFromProps(props, queryFetcher, retryCallbacks, requestCacheKey) {
  var environment = props.environment,
      query = props.query,
      variables = props.variables;
  var genericEnvironment = environment;

  if (query) {
    var request = relayRuntime.getRequest(query);
    var operation = relayRuntime.createOperationDescriptor(request, variables);
    var relayContext = getContext(genericEnvironment, operation.variables);

    if (typeof requestCacheKey === 'string' && requestCache[requestCacheKey]) {
      // This same request is already in flight.
      var snapshot = requestCache[requestCacheKey].snapshot;

      if (snapshot) {
        // Use the cached response
        return {
          error: null,
          relayContext: relayContext,
          renderProps: getRenderProps(null, snapshot, queryFetcher, retryCallbacks),
          snapshot: snapshot,
          requestCacheKey: requestCacheKey
        };
      } else {
        // Render loading state
        return {
          error: null,
          relayContext: relayContext,
          renderProps: getLoadingRenderProps(),
          snapshot: null,
          requestCacheKey: requestCacheKey
        };
      }
    }

    try {
      var storeSnapshot = props.dataFrom === STORE_THEN_NETWORK ? queryFetcher.lookupInStore(genericEnvironment, operation) : null;
      var querySnapshot = queryFetcher.fetch({
        cacheConfig: props.cacheConfig,
        dataFrom: props.dataFrom,
        environment: genericEnvironment,
        onDataChange: retryCallbacks.handleDataChange,
        operation: operation
      }); // Use network data first, since it may be fresher

      var _snapshot = querySnapshot || storeSnapshot; // cache the request to avoid duplicate requests


      requestCacheKey = requestCacheKey || getRequestCacheKey(request.params, props.variables);
      requestCache[requestCacheKey] = {
        queryFetcher: queryFetcher,
        snapshot: _snapshot
      };

      if (!_snapshot) {
        return {
          error: null,
          relayContext: relayContext,
          renderProps: getLoadingRenderProps(),
          snapshot: null,
          requestCacheKey: requestCacheKey
        };
      }

      return {
        error: null,
        relayContext: relayContext,
        renderProps: getRenderProps(null, _snapshot, queryFetcher, retryCallbacks),
        snapshot: _snapshot,
        requestCacheKey: requestCacheKey
      };
    } catch (error) {
      console.error('QueryRenderer:', error);
      return {
        error: error,
        relayContext: relayContext,
        renderProps: getRenderProps(error, null, queryFetcher, retryCallbacks),
        snapshot: null,
        requestCacheKey: requestCacheKey
      };
    }
  } else {
    queryFetcher.dispose();

    var _relayContext = getContext(genericEnvironment, variables);

    return {
      error: null,
      relayContext: _relayContext,
      renderProps: getEmptyRenderProps(),
      requestCacheKey: null // if there is an error, don't cache request

    };
  }
}

/**
 * Determine if a given value is an object that implements the `Environment`
 * interface defined in `RelayEnvironmentTypes`.
 */
function isRelayEnvironment(environment) {
  return _typeof(environment) === 'object' && environment !== null && // TODO: add applyMutation/sendMutation once ready in both cores
  typeof environment.check === 'function' && typeof environment.lookup === 'function' && typeof environment.retain === 'function' && typeof environment.sendQuery === 'function' && typeof environment.execute === 'function' && typeof environment.subscribe === 'function';
}

/**
 * Determine if the object is a plain object that matches the `Variables` type.
 */
function isRelayVariables(variables) {
  return _typeof(variables) === 'object' && variables !== null && !Array.isArray(variables);
}

/**
 * Asserts that the input is a matches the `RelayContext` type defined in
 * `RelayEnvironmentTypes` and returns it as that type.
 */

function assertRelayContext(relay) {
  invariant(isRelayContext(relay), 'RelayContext: Expected `context.relay` to be an object conforming to ' + 'the `RelayContext` interface, got `%s`.', relay);
  return relay;
}
/**
 * Determine if the input is a plain object that matches the `RelayContext`
 * type defined in `RelayEnvironmentTypes`.
 */


function isRelayContext(context) {
  return _typeof(context) === 'object' && context !== null && !Array.isArray(context) && isRelayEnvironment(context.environment) && isRelayVariables(context.variables);
}

var createContainerWithFragments = function createContainerWithFragments(component, fragments) {
  var containerName = getContainerName(component) + '-fragment-container';
  return {
    name: containerName,
    data: function data() {
      var relayContext = assertRelayContext(this.props.__relayContext); // Do not provide a subscription/callback here.
      // It is possible for this render to be interrupted or aborted,
      // In which case the subscription would cause a leak.
      // We will add the subscription in componentDidMount().

      var resolver = relayRuntime.createFragmentSpecResolver(relayContext, containerName, fragments, this.$props);
      this.state = {
        data: resolver.resolve(),
        prevProps: _objectSpread2(_objectSpread2({}, this.$props), this.props),
        prevPropsContext: relayContext,
        relayProp: getRelayProp(relayContext.environment),
        resolver: resolver
      };
      return {};
    },
    methods: {
      getDerivedStateFromProps: function getDerivedStateFromProps(nextProps, prevState) {
        // Any props change could impact the query, so we mirror props in state.
        // This is an unusual pattern, but necessary for this container usecase.
        var prevProps = prevState.prevProps;
        var relayContext = assertRelayContext(nextProps.__relayContext);
        var prevIDs = relayRuntime.getDataIDsFromObject(fragments, prevProps);
        var nextIDs = relayRuntime.getDataIDsFromObject(fragments, nextProps);
        var resolver = prevState.resolver; // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.

        if (prevState.prevPropsContext.environment !== relayContext.environment || prevState.prevPropsContext.variables !== relayContext.variables || !areEqual(prevIDs, nextIDs)) {
          // Do not provide a subscription/callback here.
          // It is possible for this render to be interrupted or aborted,
          // In which case the subscription would cause a leak.
          // We will add the subscription in componentDidUpdate().
          resolver = relayRuntime.createFragmentSpecResolver(relayContext, containerName, fragments, nextProps);
          return {
            data: resolver.resolve(),
            prevPropsContext: relayContext,
            prevProps: nextProps,
            relayProp: getRelayProp(relayContext.environment),
            resolver: resolver
          };
        } else {
          resolver.setProps(nextProps);
          var data = resolver.resolve();

          if (data !== prevState.data) {
            return {
              data: data,
              prevProps: nextProps,
              prevPropsContext: relayContext,
              relayProp: getRelayProp(relayContext.environment)
            };
          }
        }

        return null;
      },
      shouldComponentUpdate: function shouldComponentUpdate(nextProps, nextState) {
        // Short-circuit if any Relay-related data has changed
        if (nextState.data !== this.state.data) {
          return true;
        } // Otherwise, for convenience short-circuit if all non-Relay props
        // are scalar and equal


        var keys = Object.keys(nextProps);

        for (var ii = 0; ii < keys.length; ii++) {
          var key = keys[ii];

          if (key === '__relayContext') {
            if (nextState.prevPropsContext.environment !== this.state.prevPropsContext.environment || nextState.prevPropsContext.variables !== this.state.prevPropsContext.variables) {
              return true;
            }
          } else {
            if (!fragments.hasOwnProperty(key) && !relayRuntime.isScalarAndEqual(nextProps[key], this.props[key])) {
              return true;
            }
          }
        }

        return false;
      },
      componentDidUpdate: function componentDidUpdate(_, prevState) {
        if (this.state.resolver !== prevState.resolver) {
          prevState.resolver.dispose();

          this._subscribeToNewResolver();
        }

        this._rerenderIfStoreHasChanged();
      },
      _handleFragmentDataUpdate: function _handleFragmentDataUpdate() {
        var resolverFromThisUpdate = this.state.resolver;
        this.setState(function (updatedState) {
          return (// If this event belongs to the current data source, update.
            // Otherwise we should ignore it.
            resolverFromThisUpdate === updatedState.resolver ? {
              data: updatedState.resolver.resolve(),
              relayProp: getRelayProp(updatedState.relayProp.environment)
            } : null
          );
        });
      },
      _rerenderIfStoreHasChanged: function _rerenderIfStoreHasChanged() {
        var _this$state = this.state,
            data = _this$state.data,
            resolver = _this$state.resolver; // External values could change between render and commit.
        // Check for this case, even though it requires an extra store read.

        var maybeNewData = resolver.resolve();

        if (data !== maybeNewData) {
          this.setState({
            data: maybeNewData
          });
        }
      },
      _subscribeToNewResolver: function _subscribeToNewResolver() {
        var resolver = this.state.resolver; // Event listeners are only safe to add during the commit phase,
        // So they won't leak if render is interrupted or errors.

        resolver.setCallback(this._handleFragmentDataUpdate);
      }
    },
    mounted: function mounted() {
      this._subscribeToNewResolver();

      this._rerenderIfStoreHasChanged();
    },
    beforeDestroy: function beforeDestroy() {
      this.state.resolver.dispose();
    }
  };
};

function getRelayProp(environment) {
  return {
    environment: environment
  };
}

var createFragmentContainer = function createFragmentContainer() {
  invariant(arguments.length === 1 || arguments.length === 2, 'createFragmentContainer: Expected `arguments.length` to be 1 or 2, got `%s`.', arguments);

  if (arguments.length === 1) {
    [].unshift.call(arguments, null);
  }

  var _arguments = Array.prototype.slice.call(arguments),
      component = _arguments[0],
      fragmentSpec = _arguments[1];

  return buildVueRelayContainer(component, fragmentSpec, createContainerWithFragments);
};

var FORWARD = 'forward';

function createGetConnectionFromProps(metadata) {
  var path = metadata.path;
  invariant(path, 'VueRelayPaginationContainer: Unable to synthesize a ' + 'getConnectionFromProps function.');
  return function (props) {
    var data = props[metadata.fragmentName];

    for (var i = 0; i < path.length; i++) {
      if (!data || _typeof(data) !== 'object') {
        return null;
      }

      data = data[path[i]];
    }

    return data;
  };
}

function createGetFragmentVariables(metadata) {
  var countVariable = metadata.count;
  invariant(countVariable, 'VueRelayPaginationContainer: Unable to synthesize a ' + 'getFragmentVariables function.');
  return function (prevVars, totalCount) {
    return _objectSpread2(_objectSpread2({}, prevVars), {}, _defineProperty({}, countVariable, totalCount));
  };
}

function findConnectionMetadata(fragments) {
  var foundConnectionMetadata = null;
  var isRelayModern = false;

  for (var fragmentName in fragments) {
    var fragment = fragments[fragmentName];
    var connectionMetadata = fragment.metadata && fragment.metadata.connection; // HACK: metadata is always set to `undefined` in classic. In modern, even
    // if empty, it is set to null (never undefined). We use that knowlege to
    // check if we're dealing with classic or modern

    if (fragment.metadata !== undefined) {
      isRelayModern = true;
    }

    if (connectionMetadata) {
      invariant(connectionMetadata.length === 1, 'VueRelayPaginationContainer: Only a single @connection is ' + 'supported, `%s` has %s.', fragmentName, connectionMetadata.length);
      invariant(!foundConnectionMetadata, 'VueRelayPaginationContainer: Only a single fragment with ' + '@connection is supported.');
      foundConnectionMetadata = _objectSpread2(_objectSpread2({}, connectionMetadata[0]), {}, {
        fragmentName: fragmentName
      });
    }
  }

  invariant(!isRelayModern || foundConnectionMetadata !== null, 'VueRelayPaginationContainer: A @connection directive must be present.');
  return foundConnectionMetadata || {};
}

function toObserver(observerOrCallback) {
  return typeof observerOrCallback === 'function' ? {
    error: observerOrCallback,
    complete: observerOrCallback,
    unsubscribe: function unsubscribe(_) {
      typeof observerOrCallback === 'function' && observerOrCallback();
    }
  } : observerOrCallback || {};
}

var createContainerWithFragments$1 = function createContainerWithFragments(component, fragments, connectionConfig) {
  var componentName = getComponentName(component);
  var containerName = getContainerName(component) + '-pagination-container';
  var metadata = findConnectionMetadata(fragments);
  var getConnectionFromProps = connectionConfig.getConnectionFromProps || createGetConnectionFromProps(metadata);
  var direction = connectionConfig.direction || metadata.direction;
  invariant(direction, 'VueRelayPaginationContainer: Unable to infer direction of the ' + 'connection, possibly because both first and last are provided.');
  var getFragmentVariables = connectionConfig.getFragmentVariables || createGetFragmentVariables(metadata);
  return {
    name: containerName,
    data: function data() {
      var relayContext = assertRelayContext(this.props.__relayContext);
      this._isARequestInFlight = false;
      this._refetchSubscription = null;
      this._refetchVariables = null;
      this._resolver = relayRuntime.createFragmentSpecResolver(relayContext, containerName, fragments, this.$props, this._handleFragmentDataUpdate);
      this.state = {
        data: this._resolver.resolve(),
        prevProps: _objectSpread2(_objectSpread2({}, this.$props), this.props),
        prevPropsContext: relayContext,
        contextForChildren: relayContext,
        relayProp: this._buildRelayProp(relayContext)
      };
      this._isUnmounted = false;
      this._hasFetched = false;
      return {};
    },
    methods: {
      getDerivedStateFromProps: function getDerivedStateFromProps(nextProps, prevState) {
        // Any props change could impact the query, so we mirror props in state.
        // This is an unusual pattern, but necessary for this container usecase.
        var prevProps = prevState.prevProps;
        var relayContext = assertRelayContext(nextProps.__relayContext);
        var prevIDs = relayRuntime.getDataIDsFromObject(fragments, prevProps);
        var nextIDs = relayRuntime.getDataIDsFromObject(fragments, nextProps); // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.

        if (prevState.prevPropsContext.environment !== relayContext.environment || prevState.prevPropsContext.variables !== relayContext.variables || !areEqual(prevIDs, nextIDs)) {
          this._cleanup(); // Child containers rely on context.relay being mutated (for gDSFP).


          this._resolver = relayRuntime.createFragmentSpecResolver(relayContext, containerName, fragments, nextProps, this._handleFragmentDataUpdate);
          return {
            data: this._resolver.resolve(),
            prevProps: nextProps,
            prevPropsContext: relayContext,
            contextForChildren: relayContext,
            relayProp: this._buildRelayProp(relayContext)
          };
        } else if (!this._hasFetched) {
          this._resolver.setProps(nextProps);
        }

        var data = this._resolver.resolve();

        if (data !== this.state.data) {
          return {
            data: data,
            prevProps: nextProps
          };
        }

        return null;
      },
      shouldComponentUpdate: function shouldComponentUpdate(nextProps, nextState) {
        // Short-circuit if any Relay-related data has changed
        if (nextState.data !== this.state.data || nextState.relayProp !== this.state.relayProp) {
          return true;
        } // Otherwise, for convenience short-circuit if all non-Relay props
        // are scalar and equal


        var keys = Object.keys(nextProps);

        for (var ii = 0; ii < keys.length; ii++) {
          var key = keys[ii];

          if (key === '__relayContext') {
            if (nextState.prevPropsContext.environment !== this.state.prevPropsContext.environment || nextState.prevPropsContext.variables !== this.state.prevPropsContext.variables) {
              return true;
            }
          } else {
            if (!fragments.hasOwnProperty(key) && !relayRuntime.isScalarAndEqual(nextProps[key], this.props[key])) {
              return true;
            }
          }
        }

        return false;
      },
      componentDidUpdate: function componentDidUpdate() {},
      _buildRelayProp: function _buildRelayProp(relayContext) {
        return {
          hasMore: this._hasMore,
          isLoading: this._isLoading,
          loadMore: this._loadMore,
          refetchConnection: this._refetchConnection,
          environment: relayContext.environment
        };
      },
      _handleFragmentDataUpdate: function _handleFragmentDataUpdate() {
        this.setState({
          data: this._resolver.resolve()
        });
      },
      _getConnectionData: function _getConnectionData() {
        // Extract connection data and verify there are more edges to fetch
        var restProps = this.$props;

        var props = _objectSpread2(_objectSpread2({}, restProps), this.state.data);

        var connectionData = getConnectionFromProps(props);

        if (connectionData == null) {
          return null;
        }

        var _ConnectionInterface$ = relayRuntime.ConnectionInterface.get(),
            EDGES = _ConnectionInterface$.EDGES,
            PAGE_INFO = _ConnectionInterface$.PAGE_INFO,
            HAS_NEXT_PAGE = _ConnectionInterface$.HAS_NEXT_PAGE,
            HAS_PREV_PAGE = _ConnectionInterface$.HAS_PREV_PAGE,
            END_CURSOR = _ConnectionInterface$.END_CURSOR,
            START_CURSOR = _ConnectionInterface$.START_CURSOR;

        invariant(_typeof(connectionData) === 'object', 'VueRelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' + 'to return `null` or a plain object with %s and %s properties, got `%s`.', componentName, EDGES, PAGE_INFO, connectionData);
        var edges = connectionData[EDGES];
        var pageInfo = connectionData[PAGE_INFO];

        if (edges == null || pageInfo == null) {
          return null;
        }

        invariant(Array.isArray(edges), 'VueRelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' + 'to return an object with %s: Array, got `%s`.', componentName, EDGES, edges);
        invariant(_typeof(pageInfo) === 'object', 'VueRelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' + 'to return an object with %s: Object, got `%s`.', componentName, PAGE_INFO, pageInfo);
        var hasMore = direction === FORWARD ? pageInfo[HAS_NEXT_PAGE] : pageInfo[HAS_PREV_PAGE];
        var cursor = direction === FORWARD ? pageInfo[END_CURSOR] : pageInfo[START_CURSOR];

        if (typeof hasMore !== 'boolean' || edges.length !== 0 && typeof cursor === 'undefined') {
          warning(false, 'VueRelayPaginationContainer: Cannot paginate without %s fields in `%s`. ' + 'Be sure to fetch %s (got `%s`) and %s (got `%s`).', PAGE_INFO, componentName, direction === FORWARD ? HAS_NEXT_PAGE : HAS_PREV_PAGE, hasMore, direction === FORWARD ? END_CURSOR : START_CURSOR, cursor);
          return null;
        }

        return {
          cursor: cursor,
          edgeCount: edges.length,
          hasMore: hasMore
        };
      },
      _hasMore: function _hasMore() {
        var connectionData = this._getConnectionData();

        return !!(connectionData && connectionData.hasMore && connectionData.cursor);
      },
      _isLoading: function _isLoading() {
        return !!this._refetchSubscription;
      },
      _refetchConnection: function _refetchConnection(totalCount, observerOrCallback, refetchVariables) {
        if (!this._canFetchPage('refetchConnection')) {
          return {
            dispose: function dispose() {}
          };
        }

        this._refetchVariables = refetchVariables;
        var paginatingVariables = {
          count: totalCount,
          cursor: null,
          totalCount: totalCount
        };

        var fetch = this._fetchPage(paginatingVariables, toObserver(observerOrCallback), {
          force: true
        });

        return {
          dispose: fetch.unsubscribe
        };
      },
      _loadMore: function _loadMore(pageSize, observerOrCallback, options) {
        if (!this._canFetchPage('loadMore')) {
          return {
            dispose: function dispose() {}
          };
        }

        var observer = toObserver(observerOrCallback);

        var connectionData = this._getConnectionData();

        if (!connectionData) {
          relayRuntime.Observable.create(function (sink) {
            return sink.complete();
          }).subscribe(observer);
          return null;
        }

        var totalCount = connectionData.edgeCount + pageSize;

        if (options && options.force) {
          return this._refetchConnection(totalCount, observerOrCallback);
        }

        var _ConnectionInterface$2 = relayRuntime.ConnectionInterface.get(),
            END_CURSOR = _ConnectionInterface$2.END_CURSOR,
            START_CURSOR = _ConnectionInterface$2.START_CURSOR;

        var cursor = connectionData.cursor;
        warning(cursor, 'VueRelayPaginationContainer: Cannot `loadMore` without valid `%s` (got `%s`)', direction === FORWARD ? END_CURSOR : START_CURSOR, cursor);
        var paginatingVariables = {
          count: pageSize,
          cursor: cursor,
          totalCount: totalCount
        };

        var fetch = this._fetchPage(paginatingVariables, observer, options);

        return {
          dispose: fetch.unsubscribe
        };
      },
      _getQueryFetcher: function _getQueryFetcher() {
        if (!this._queryFetcher) {
          this._queryFetcher = new VueRelayQueryFetcher();
        }

        return this._queryFetcher;
      },
      _canFetchPage: function _canFetchPage(method) {
        if (this._isUnmounted) {
          warning(false, 'VueRelayPaginationContainer: Unexpected call of `%s` ' + 'on unmounted container `%s`. It looks like some instances ' + 'of your container still trying to fetch data but they already ' + 'unmounted. Please make sure you clear all timers, intervals, async ' + 'calls, etc that may trigger `%s` call.', method, containerName, method);
          return false;
        }

        return true;
      },
      _fetchPage: function _fetchPage(paginatingVariables, observer, options) {
        var _this = this;

        var _assertRelayContext = assertRelayContext(this.props.__relayContext),
            environment = _assertRelayContext.environment;

        var restProps = this.$props;

        var props = _objectSpread2(_objectSpread2({}, restProps), this.state.data);

        var rootVariables;
        var fragmentVariables;
        var fragmentOwners = relayRuntime.getFragmentOwners(fragments, restProps); // NOTE: rootVariables are spread down below in a couple of places,
        // so we compute them here from the fragment owners.
        // For extra safety, we make sure the rootVariables include the
        // variables from all owners in this fragmentSpec, even though they
        // should all point to the same owner

        forEachObject(fragments, function (__, key) {
          var fragmentOwner = fragmentOwners[key];
          var fragmentOwnerVariables = Array.isArray(fragmentOwner) ? fragmentOwner[0] && fragmentOwner[0].variables ? fragmentOwner[0].variables : {} : fragmentOwner && fragmentOwner.variables ? fragmentOwner.variables : {};
          rootVariables = _objectSpread2(_objectSpread2({}, rootVariables), fragmentOwnerVariables);
        });
        fragmentVariables = relayRuntime.getVariablesFromObject( // NOTE: We pass empty operationVariables because we want to prefer
        // the variables from the fragment owner
        {}, fragments, restProps, fragmentOwners);
        fragmentVariables = _objectSpread2(_objectSpread2(_objectSpread2({}, rootVariables), fragmentVariables), this._refetchVariables);
        var fetchVariables = connectionConfig.getVariables(props, {
          count: paginatingVariables.count,
          cursor: paginatingVariables.cursor
        }, fragmentVariables);
        invariant(_typeof(fetchVariables) === 'object' && fetchVariables !== null, 'VueRelayPaginationContainer: Expected `getVariables()` to ' + 'return an object, got `%s` in `%s`.', fetchVariables, componentName);
        fetchVariables = _objectSpread2(_objectSpread2({}, fetchVariables), this._refetchVariables);
        fragmentVariables = _objectSpread2(_objectSpread2({}, fetchVariables), fragmentVariables);
        var cacheConfig = options ? {
          force: !!options.force
        } : undefined;
        var request = relayRuntime.getRequest(connectionConfig.query);
        var operation = relayRuntime.createOperationDescriptor(request, fetchVariables);
        var refetchSubscription = null;

        if (this._refetchSubscription) {
          this._refetchSubscription.unsubscribe();
        }

        this._hasFetched = true;

        var onNext = function onNext(_, complete) {
          var contextVariables = _objectSpread2(_objectSpread2({}, _this.props.__relayContext.variables), fragmentVariables);

          var prevData = _this._resolver.resolve();

          _this._resolver.setVariables(getFragmentVariables(fragmentVariables, paginatingVariables.totalCount), operation.node);

          var nextData = _this._resolver.resolve(); // Workaround slightly different handling for connection in different
          // core implementations:
          // - Classic core requires the count to be explicitly incremented
          // - Modern core automatically appends new items, updating the count
          //   isn't required to see new data.
          //
          // `setState` is only required if changing the variables would change the
          // resolved data.
          // TODO #14894725: remove PaginationContainer equal check


          if (!areEqual(prevData, nextData)) {
            _this.setState({
              data: nextData,
              contextForChildren: {
                environment: _this.props.__relayContext.environment,
                variables: contextVariables
              }
            }, complete);
          } else {
            complete();
          }
        };

        var cleanup = function cleanup() {
          if (_this._refetchSubscription === refetchSubscription) {
            _this._refetchSubscription = null;
            _this._isARequestInFlight = false;
          }

          _this.$forceUpdate(); // https://github.com/facebook/relay/issues/1973#issuecomment-325441743

        };

        this._isARequestInFlight = true;
        refetchSubscription = this._getQueryFetcher().execute({
          environment: environment,
          operation: operation,
          cacheConfig: cacheConfig,
          preservePreviousReferences: true
        }).mergeMap(function (payload) {
          return relayRuntime.Observable.create(function (sink) {
            onNext(payload, function () {
              sink.next(); // pass void to public observer's `next`

              sink.complete();
            });
          });
        }) // use do instead of finally so that observer's `complete` fires after cleanup
        ["do"]({
          error: cleanup,
          complete: cleanup,
          unsubscribe: cleanup
        }).subscribe(observer || {});
        this._refetchSubscription = this._isARequestInFlight ? refetchSubscription : null;
        this.$forceUpdate(); // https://github.com/facebook/relay/issues/1973#issuecomment-325441743

        return refetchSubscription;
      },
      _cleanup: function _cleanup() {
        this._resolver.dispose();

        this._refetchVariables = null;
        this._hasFetched = false;

        if (this._refetchSubscription) {
          this._refetchSubscription.unsubscribe();

          this._refetchSubscription = null;
          this._isARequestInFlight = false;
        }

        if (this._queryFetcher) {
          this._queryFetcher.dispose();
        }
      }
    },
    beforeDestroy: function beforeDestroy() {
      this._isUnmounted = true;

      this._cleanup();
    }
  };
};

var createPaginationContainer = function createPaginationContainer() {
  invariant(arguments.length === 2 || arguments.length === 3, 'createPaginationContainer: Expected `arguments.length` to be 2 or 3, got `%s`.', arguments);

  if (arguments.length === 2) {
    [].unshift.call(arguments, null);
  }

  var _arguments = Array.prototype.slice.call(arguments),
      component = _arguments[0],
      fragmentSpec = _arguments[1],
      connectionConfig = _arguments[2];

  return buildVueRelayContainer(component, fragmentSpec, function (component, fragments) {
    return createContainerWithFragments$1(component, fragments, connectionConfig);
  });
};

var createContainerWithFragments$2 = function createContainerWithFragments(component, fragments, taggedNode) {
  var containerName = getContainerName(component) + '-refetch-container';
  return {
    name: containerName,
    data: function data() {
      var relayContext = assertRelayContext(this.props.__relayContext);
      this._refetchSubscription = null; // Do not provide a subscription/callback here.
      // It is possible for this render to be interrupted or aborted,
      // In which case the subscription would cause a leak.
      // We will add the subscription in componentDidMount().

      var resolver = relayRuntime.createFragmentSpecResolver(relayContext, containerName, fragments, this.$props);
      this.state = {
        data: resolver.resolve(),
        localVariables: null,
        prevProps: _objectSpread2(_objectSpread2({}, this.$props), this.props),
        prevPropsContext: relayContext,
        contextForChildren: relayContext,
        relayProp: getRelayProp$1(relayContext.environment, this._refetch),
        resolver: resolver
      };
      this._isUnmounted = false;
      return {};
    },
    methods: {
      getDerivedStateFromProps: function getDerivedStateFromProps(nextProps, prevState) {
        // Any props change could impact the query, so we mirror props in state.
        // This is an unusual pattern, but necessary for this container usecase.
        var prevProps = prevState.prevProps;
        var relayContext = assertRelayContext(nextProps.__relayContext);
        var prevIDs = relayRuntime.getDataIDsFromObject(fragments, prevProps);
        var nextIDs = relayRuntime.getDataIDsFromObject(fragments, nextProps);
        var resolver = prevState.resolver; // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.

        if (prevState.prevPropsContext.environment !== relayContext.environment || prevState.prevPropsContext.variables !== relayContext.variables || !areEqual(prevIDs, nextIDs)) {
          // Do not provide a subscription/callback here.
          // It is possible for this render to be interrupted or aborted,
          // In which case the subscription would cause a leak.
          // We will add the subscription in componentDidUpdate().
          resolver = relayRuntime.createFragmentSpecResolver(relayContext, containerName, fragments, nextProps);
          return {
            data: resolver.resolve(),
            localVariables: null,
            prevProps: nextProps,
            prevPropsContext: relayContext,
            contextForChildren: relayContext,
            relayProp: getRelayProp$1(relayContext.environment, prevState.relayProp.refetch),
            resolver: resolver
          };
        } else if (!prevState.localVariables) {
          resolver.setProps(nextProps);
        }

        var data = resolver.resolve();

        if (data !== prevState.data) {
          return {
            data: data,
            prevProps: nextProps
          };
        }

        return null;
      },
      shouldComponentUpdate: function shouldComponentUpdate(nextProps, nextState) {
        // Short-circuit if any Relay-related data has changed
        if (nextState.data !== this.state.data || nextState.relayProp !== this.state.relayProp) {
          return true;
        } // Otherwise, for convenience short-circuit if all non-Relay props
        // are scalar and equal


        var keys = Object.keys(nextProps);

        for (var ii = 0; ii < keys.length; ii++) {
          var key = keys[ii];

          if (key === '__relayContext') {
            if (this.state.prevPropsContext.environment !== nextState.prevPropsContext.environment || this.state.prevPropsContext.variables !== nextState.prevPropsContext.variables) {
              return true;
            }
          } else {
            if (!fragments.hasOwnProperty(key) && !relayRuntime.isScalarAndEqual(nextProps[key], this.props[key])) {
              return true;
            }
          }
        }

        return false;
      },
      componentDidUpdate: function componentDidUpdate(_, prevState) {
        // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.
        if (this.state.resolver !== prevState.resolver) {
          prevState.resolver.dispose();
          this._queryFetcher && this._queryFetcher.dispose();
          this._refetchSubscription && this._refetchSubscription.unsubscribe();

          this._subscribeToNewResolver();
        }
      },
      _subscribeToNewResolver: function _subscribeToNewResolver() {
        var _this$state = this.state,
            data = _this$state.data,
            resolver = _this$state.resolver; // Event listeners are only safe to add during the commit phase,
        // So they won't leak if render is interrupted or errors.

        resolver.setCallback(this._handleFragmentDataUpdate); // External values could change between render and commit.
        // Check for this case, even though it requires an extra store read.

        var maybeNewData = resolver.resolve();

        if (data !== maybeNewData) {
          this.setState({
            data: maybeNewData
          });
        }
      },
      _handleFragmentDataUpdate: function _handleFragmentDataUpdate() {
        var resolverFromThisUpdate = this.state.resolver;
        this.setState(function (updatedState) {
          return (// If this event belongs to the current data source, update.
            // Otherwise we should ignore it.
            resolverFromThisUpdate === updatedState.resolver ? {
              data: updatedState.resolver.resolve()
            } : null
          );
        });
      },
      _getFragmentVariables: function _getFragmentVariables() {
        return relayRuntime.getVariablesFromObject( // NOTE: We pass empty operationVariables because we want to prefer
        // the variables from the fragment owner
        {}, fragments, this.$props, relayRuntime.getFragmentOwners(fragments, this.$props));
      },
      _getQueryFetcher: function _getQueryFetcher() {
        if (!this._queryFetcher) {
          this._queryFetcher = new VueRelayQueryFetcher();
        }

        return this._queryFetcher;
      },
      _refetch: function _refetch(refetchVariables, renderVariables, observerOrCallback, options) {
        var _this = this;

        if (this._isUnmounted) {
          warning(false, 'VueRelayRefetchContainer: Unexpected call of `refetch` ' + 'on unmounted container `%s`. It looks like some instances ' + 'of your container still trying to refetch the data but they already ' + 'unmounted. Please make sure you clear all timers, intervals, async ' + 'calls, etc that may trigger `refetch`.', containerName);
          return {
            dispose: function dispose() {}
          };
        }

        var _assertRelayContext = assertRelayContext(this.props.__relayContext),
            environment = _assertRelayContext.environment,
            rootVariables = _assertRelayContext.variables;

        var fetchVariables = typeof refetchVariables === 'function' ? refetchVariables(this._getFragmentVariables()) : refetchVariables;
        fetchVariables = _objectSpread2(_objectSpread2({}, rootVariables), fetchVariables);
        var fragmentVariables = renderVariables ? _objectSpread2(_objectSpread2({}, fetchVariables), renderVariables) : fetchVariables;
        var cacheConfig = options ? {
          force: !!options.force
        } : undefined;
        var observer = typeof observerOrCallback === 'function' ? {
          // callback is not exectued on complete or unsubscribe
          // for backward compatibility
          next: observerOrCallback,
          error: observerOrCallback
        } : observerOrCallback || {};
        var query = relayRuntime.getRequest(taggedNode);
        var operation = relayRuntime.createOperationDescriptor(query, fetchVariables); // TODO: T26288752 find a better way

        this.state.localVariables = fetchVariables; // Cancel any previously running refetch.

        this._refetchSubscription && this._refetchSubscription.unsubscribe(); // Declare refetchSubscription before assigning it in .start(), since
        // synchronous completion may call callbacks .subscribe() returns.

        var refetchSubscription;

        if (options && options.fetchPolicy === 'store-or-network') {
          var storeSnapshot = this._getQueryFetcher().lookupInStore(environment, operation);

          if (storeSnapshot != null) {
            this.state.resolver.setVariables(fragmentVariables, operation.node);
            this.setState(function (latestState) {
              return {
                data: latestState.resolver.resolve(),
                contextForChildren: {
                  environment: _this.props.__relayContext.environment,
                  variables: fragmentVariables
                }
              };
            }, function () {
              observer.next && observer.next();
              observer.complete && observer.complete();
            });
            return {
              dispose: function dispose() {}
            };
          }
        }

        this._getQueryFetcher().execute({
          environment: environment,
          operation: operation,
          cacheConfig: cacheConfig,
          // TODO (T26430099): Cleanup old references
          preservePreviousReferences: true
        }).mergeMap(function (_) {
          _this.state.resolver.setVariables(fragmentVariables, operation.node);

          return relayRuntime.Observable.create(function (sink) {
            return _this.setState(function (latestState) {
              return {
                data: latestState.resolver.resolve(),
                contextForChildren: {
                  environment: _this.props.__relayContext.environment,
                  variables: fragmentVariables
                }
              };
            }, function () {
              sink.next();
              sink.complete();
            });
          });
        })["finally"](function () {
          // Finalizing a refetch should only clear this._refetchSubscription
          // if the finizing subscription is the most recent call.
          if (_this._refetchSubscription === refetchSubscription) {
            _this._refetchSubscription = null;
          }
        }).subscribe(_objectSpread2(_objectSpread2({}, observer), {}, {
          start: function start(subscription) {
            _this._refetchSubscription = refetchSubscription = subscription;
            observer.start && observer.start(subscription);
          }
        }));

        return {
          dispose: function dispose() {
            refetchSubscription && refetchSubscription.unsubscribe();
          }
        };
      }
    },
    mounted: function mounted() {
      this._subscribeToNewResolver();
    },
    beforeDestroy: function beforeDestroy() {
      this._isUnmounted = true;
      this.state.resolver.dispose();
      this._queryFetcher && this._queryFetcher.dispose();
      this._refetchSubscription && this._refetchSubscription.unsubscribe();
    }
  };
};

function getRelayProp$1(environment, refetch) {
  return {
    environment: environment,
    refetch: refetch
  };
}

var createRefetchContainer = function createRefetchContainer() {
  invariant(arguments.length === 2 || arguments.length === 3, 'createRefetchContainer: Expected `arguments.length` to be 2 or 3, got `%s`.', arguments);

  if (arguments.length === 2) {
    [].unshift.call(arguments, null);
  }

  var _arguments = Array.prototype.slice.call(arguments),
      component = _arguments[0],
      fragmentSpec = _arguments[1],
      taggedNode = _arguments[2];

  return buildVueRelayContainer(component, fragmentSpec, function (component, fragments) {
    return createContainerWithFragments$2(component, fragments, taggedNode);
  });
};

var index = {
  QueryRenderer: VueRelayQueryRenderer,
  MutationTypes: relayRuntime.MutationTypes,
  RangeOperations: relayRuntime.RangeOperations,
  applyOptimisticMutation: relayRuntime.applyOptimisticMutation,
  commitLocalUpdate: relayRuntime.commitLocalUpdate,
  commitMutation: relayRuntime.commitMutation,
  createFragmentContainer: createFragmentContainer,
  createPaginationContainer: createPaginationContainer,
  createRefetchContainer: createRefetchContainer,
  fetchQuery: relayRuntime.fetchQuery,
  graphql: relayRuntime.graphql,
  requestSubscription: relayRuntime.requestSubscription
};

module.exports = index;
