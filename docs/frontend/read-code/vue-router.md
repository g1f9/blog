# VueRouter 实现解析

## 概述

Vue Router 是 Vue 的一个插件，实现了单页应用的路由导航功能。主要思路是在路由发生改变时，触发 router-view 重新渲染对应的组件，在执行 install 的时候，主要做的事情就是混入 Vue 函数的 beforeCreate 钩子，在这个钩子里面初始化 VueRouter的实例，并在 Vue 的实例上定义了响应式的 _route 指向当前 route，router-view 在渲染时会访问 _route，那么在 _route 改变时就会重新渲染 router-view。url 的改变则通过监听 hashChange 和 H5 History 的 popstate 方法，匹配到对应的 route，然后更新 _route 来重新渲染 router-view。VueRoute 大致分为以下几个逻辑

1. 注册初始化逻辑
2. 路由配置解析逻辑
3. 路由匹配逻辑
4. 路径切换逻辑
5. 组件渲染逻辑

### Vue Route 的整体设计思路

VueRoute 中有几个关键的类，VueRouter 用来管理配置信息，对接 Vue，是一个对外暴露，整合其他子系统的类。History 类负责了两个路由之间的切换，根据切换的 location 匹配到对应的 route，以及切换过程中调用一系列钩子。Matcher 只是一个对象，包含了 match 函数和 addRoutes 函数，使用 createMatcher 函数来创建 matcher，并使用了闭包来保存路由映射解析记录，之所以使用闭包我认为是为了让解析记录私有化。RouteRecord 则存放解析的匹配记录。Route 类作为路由信息的载体在 VueRoute 的工作过程中传递信息。

### 注册初始化模块

​注册初始化模块主要做的事情，就是在 vue 的 beforeCreate 钩子混入自己的函数。在 Vue 实例初始化的时候，初始 VueRouter 实例。随后调用 registerIntance 函数。registerInstance 函数是给函数组件 router-view 使用，因为混入了 Vue 函数的 beforeCreate 所以每个组件都会调用，则是 registerInstance 判断组件是否定义了 registerRouteInstance 方法，如果有的话就调用。通过这种方式，在编写视图组件时，只需要定义 re gterRouterInstance 方法，那么就会自动在 beforeCreate 里调用了。

​VueRouter 有两个初始化的过程，一个是在 new VueRouter 的时候把内部属性进行初始话，主要过程有根据router 创建 matcher，决定使用哪种模式。另一个在 Vue 组件实例初始化的过程，调用的 this._router.init(this)，这个过程则不是类的实例初始化过程，而是路由功能初始化的过程。在这个过程中主要做了以下事情：

1. 存储 Vue 实例
2. 切换路由（关键）。比如 router-view 在切换监听切换之前，总得有一次初始化渲染吧。这里就做类似这样的事情，手动调用一次切换来渲染 router-view
3. 注册监听函数。这个主要用于在 History 类完成路由切换的时候，把 Vue 实例上的 _route 设置当前 route。\_route 又是响应式，router-view 在渲染时会去访问，那么 _route 的在改变的过程中，就会去重新渲染视图了。

### 路由匹配

路由匹配主要 Matcher 来实现，在 VueRouter 构造的时候，传入 routes 配置，VueRouter 根据这个配置生成 matcher。matcher 需要解析 routes 配置，并生成映射，在这里为了防止 routes 映射被改变，使用闭包来存储解析好的映射，是私有变量的一种实现。Matcher 主要由两部分组成，addRoutes 负责添加新的路由映射，match 负责根据路径返回新的 Route。

#### 路由映射生成

matcher 的内部映射主要是生成 name 和 path 到 RouteRecord 的映射。在生成映射的时候，从父元素开始，遇到子元素，那么就递归添加子元素的映射，因此最后生成的 RouteRecord 也是一个树形结构。route 映射的生成主要是由 addRouteRecord 生成。具体看一下这个函数的生成

````javascript
function addRouteRecord (
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  const { path, name } = route
  const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
  const normalizedPath = normalizePath(
    path,
    parent,
    pathToRegexpOptions.strict
  )
	// 格式化路径，主要用于 parent 和 children 的path 拼接
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  const record: RouteRecord = {
    path: normalizedPath,//格式化路径
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions), //使用 path-to-regex 这个库把路径定义编译成正则。
    components: route.components || { default: route.component },
    instances: {},
    name,
    parent,
    matchAs, //路径到路径的映射，标识着这个路径映射到其他路径
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props: route.props == null
      ? {}
      : route.components
        ? route.props
        : { default: route.props }
  }
	
  // 把当前 RouteRecord 作为 parent，递归添加 children routes
  if (route.children) {
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }
	
  // 别名处理，其实就是再添加一条 RouteRecord 记录，然后把这条 record 的matchAs 指向当前 path，形成了 path 到 path 的映射。值得注意的是 alias 的 children 又会被添加一次别名记录。
  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias)
      ? route.alias
      : [route.alias]

    aliases.forEach(alias => {
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    })
  }
	// 最后就是检测和存储
  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record
    } 
  }
}
````

以上就是 RouteRecord 映射的生成过程，主要是针对 path，children，和 alias 的处理。path 的处理是编译成正则，children 则是合并和 parent 的path，生成新的path。alias 是以新的 path 再添加一次 RouteRecord，并将 matchAs 指向原来的 path，形成 path 到 path 的映射。

#### match 匹配

match 函数的主要作用就是根据 location，生成 Route 数据的过程。将 location 格式化后，用 name 或者 path 参数取得 RouteRecord 生成 Route。主要处理各种分支情况。Route 的有个 matched 参数，就是根据当前 RouteRecord，递归访问 parent，加入到数组中，相当于把树拍平， 如：[RouteRecord({parent1}),RouteRecord{parent2},RouteRecord{current}]

## 路由切换

路由切换主要由 history 类的 transitionTo 来处理。transitonTo 首先取出 route，然后调用 confirmTransition 方法，来确定导航。主要看一下 confirmTransition 方法。首先定义了 abort 方法。接着对比 matched，从中提取 updated，actived，deactived 状态的 RouteRecord。接着定义 queue，从中提取钩子函数形成钩子队列。extractGuards 的过程有一个值得学习的地方，就是在提取时返回的函数先绑定了 this，从而在执行钩子时不需要当心 this 的执行。从队列的定义过程中，我们可以看出钩子的执行顺序。

1. 执行失活组件的 beforeRouteLeave 钩子
2. 执行全局的 beforeHooks
3. 执行更新组件的 beforeRouteUpdate 钩子 // 从中我们可以看出，当子路由更新时，父路由只会执行 beforeRouteUpdate 钩子
4. 执行激活组件的 beforeEnter 钩子
5. 解析异步组件

接着就是执行队列的过程，也是一个非常值得学习的重点。

接着就是执行我们的钩子函数，

```javascript
confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current
    const abort = err => {
      if (isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => { cb(err) })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }
    if (
      isSameRoute(route, current) &&
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort()
    }

    const {
      updated,
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)
		
    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      extractLeaveGuards(deactivated),
      // global before hooks
      this.router.beforeHooks,
      // in-component update hooks
      extractUpdateHooks(updated),
      // in-config enter guards
      activated.map(m => m.beforeEnter),
      // async components
      resolveAsyncComponents(activated)
    )
  	// 首先定义了钩子队列，
		
    this.pending = route
    const iterator = (hook: NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort()
      }
      try {
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' && (
              typeof to.path === 'string' ||
              typeof to.name === 'string'
            ))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        onComplete(route)
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => { cb() })
          })
        }
      })
    })
  }
```



#### resolveQueue

这个方法根据 matched 两个 RouteRecord 的数组，提取对应的数据。由于 RouteRecord 是树形结构，matched 是将 RouteRecord 树拍平后的数据提取出的数组，对应着一条路径。如 [RouteRecord{p1},RouteRecord(p2),RouteRecord(current)]。而 resolveQueue 则对比两个 matched，提取需激活，失活，更新的 RouteRecord。为了执行对应的钩子函数。

```javascript
function resolveQueue (
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  // 从前往后检索，找到第一个不同的 RouteRecord 的下标 i，next i往前的就是 updated ，i 往后的就是 actived，current 的 i 往后的就是 deactiveed
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}
```

#### 异步队列执行过程

队列的执行主要由两个函数组成，iterator 遍历器，和 runQueue 入口。队列的函数本身没有回调来通知执行一下步操作，因此需要一个机制通知执行下一步操作。这里遍历器相当于一个桥梁的作用，由遍历器来执行钩子，并把遍历器设计带回调的形式，这样就能够在恰当的时机执行回调，从而顺序执行异步队列。

```javascript
function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    if (index >= queue.length) {
      cb()
    } else {
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        step(index + 1)
      }
    }
  }
  step(0)
}
const iterator = (hook,next)=>{
  hook(route,	current,()=>{
    next()
  })
}
runQueue([a,b,c])
//

```

### RouterView 的更新

在 confirmTransitionTo 方法的回调中，调用了 updateRoute 方法，updateRoute 方法执行了 this.cb，执行 init 里面注册的回调。而在 init 方法中，history.listen 把 route 的值赋值给 app._route。在 VueRouter 的 install 钩子中，已经把 _route 定义为响应式了，router-view 在渲染时回去访问 _route，\_route 在更改时就会触发 router-view 的重新更新。

```javascript
class VueRouter{
  init(){
		...
  	history.listen(route => {
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }
}
class History{
  updateRoute(route){
    ...
    this.cb && this.cb(route)
    ...
  }
}
render(){
   
}
```

