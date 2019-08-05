# Axios 解析

Axios 的核心代码存放在 Lib/Axios.js 下，定义 Axios 类的实现。在 Axios 实例初始化的时候，主要做的事情就是存放配置和初始化拦截器。拦截器有请求拦截器和响应拦截器，之所以使用单独的类来实现拦截器，而不是在 Axios 里直接存放函数数组，是因为拦截器有添加和删除等额外逻辑，如果直接放在 Axios 里面会使这个 Axios 类变得臃肿，因此使用单独的 InterceptorManager 类来管理这些拦截器，是单一职责原则的一个很好的体现。

## InterceptorManager 拦截器管理

```javascript
function InterceptorManager() {
  this.handlers = [];
}
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};
```

可以看到连接器管理类只是一个管理回调方法的类，定义了 use 和 eject 方法，实现也比较简单，就只是存放回调对象而已

### Axios.Request

Axios 的核心方法就是 request 方法，其他方法不过在这基础之上去调用 request 方法而已。

```javascript
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);
  config.method = config.method ? config.method.toLowerCase() : 'get';

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);
  
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};
```

​	request 的方法是设计得比较有意思得是，它的链式设计是采用 promise 来实现的。第一步是合并配置项，将传进来的配置和默认配置进行合并，mergeConfig 方法也是学习的一个重点。首先链条初始化为一个dispatchRequest 函数，和一个 undefined 组成的 chain 数组。数组的每两项分别用于 promise 的 resovle 和 reject 时的回调。接着把请求拦截器推向链条前端，这时可以看出后添加的请求拦截器反而先执行。而在响应则是把响应拦截器的回调推到链条末尾。然后使用 while 循环和 then 来构成 promise 链。由于是使用 promise 来实现链式设计，那么我们在使用的时候就要注意在请求拦截器和响应拦截器中，如果不返回数据那么下一个拦截器就会接收不到数据。当我们更改响应和配置时就要考虑一下拦截器的顺序。

### dispatchRequest 函数

dispatchRequest 函数主要做三件事

1. 检查是否取消发送请求
2. 格式化配置
3. 调用 adapter 发送请求

dispatchRequest 函数将实际发送请求的方法由配置项传入或者默认配置，从而使我们能够轻松自定义发送请求函数。adapter 主要有两个，http 请求和 xhr 请求，而 Axios 也是通过 adapter 来实现 node 端和 web 端的适配，是依赖注入的一种很好的体现。http 请求主要通过 node 的 http 模块来实现，而浏览器端则是使用 XMLHttpRequest 对象。当默认的适配器满足不了需求时，我们也可以通过自定义 adapter 方法。

### Cancel 

在 Promise 链中，取消发送通过检测 config 里的 cancelToken 来实现。在dispatchRequest 的第一件事里就是检测 config 中是否含有 cancelToken，如果有 cancelToken 的话则调用 cancelToken 的 throwIfRequested 方法，来取消发送。因此即使提前使用 Cancel 来取消发送，

```javascript
function dispatchRequest(config) {
  	//从 config 中检测是否含有 cancelToken，有的话就抛出异常
  	throwIfCancellationRequested(config);
  	...
}
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}
// CancelToken 的具体实现
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

```

CancelToken 的需要传入一个 executor 函数，在初始化实例的时候会调用这个函数，并传入一个 cancel 方法，这是为了让我们自己掌握取消的时机，我们可以随时可以调用这个函数来取消请求的发送。这一点在设计上跟 promise 有点相似

```javascript
let cancel;
new CancelToken((c)=>{(
 cancel = c
})
setTimeout(()=>{
 cancel()
},3000)


```

### 



