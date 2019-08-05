# Vuex 解析

### install

Vuex 的 install 方法主要是混入 beforeCreate 方法，将 vuex 的 store 绑定到实例上，使我们可以在任意地方通过 this.$store 来访问仓库。

```javascript
function vuexInit () {
    const options = this.$options
    // store injection
    if (options.store) {
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
      this.$store = options.parent.$store
    }
  }
```

### Vuex 初始化

vuex 初始化的代码在 src/store.js 文件下，初始化的过程主要做一下几件事

1. 解析配置，形成模块树。vuex 是支持模块机制的，模块中又可以包含模块，因此 vuex 用一个 Module 来组织模块树，module 类有个 children 属性来存储子模块指针。每个模块都有自己的 state，mutation，action 和 getter。
2. 属性初始化
3. 安装模块。这个过程主要是在注册 mutations，actions，getters 到 store 对象上，并创建模块上下文。这个过程会递归地进行直到安装所有模块
4. 注册 vm。这个过程是 vuex 响应式过程的处理。相对于使用全局对象来共享变量，vuex state 的更改可以触发界面的更新。vuex 利用了 vue 对象的响应式机制，通过 vue 的 api 我们可以把某一个对象定义成响应式，当数据更改时就能触发界面更新。

## 构建模块树

构建模块树的过程是将原本的配置进行解析，用于生成树结构，方便后续进行操作。将对象的嵌套结构解析成树结构

```javascript
class Store{
  constructor(options){
    ...
    this.modules = new ModuleCollection(options)
  }
}
class ModuleCollection{
  constructor(rawModule){
    this.register([],rawRootModule)
  }
  register(path,rawModule){
    // path 是用 key 组成的一个数组。根模块为空数组
    const newModule = new Module(rawModule)
    if(path.length===0){
      this.root = newModule
    }else{
      //不是根模块的话，就根据 path 找到父模块，把当前模块添加到父模块的子模块中
      const parent = this.getParent(path.slice(0,-1))
      parent.addChild(newModule,path[path.length-1])
    }
    // 递归注册模块
    if(rawModules.modules){
      forEachValue(rawModules.modules,(module,key)=>{
      	this.register(path.concat(key),module)
    	})
    }
  }
}
class Module{
   constructor(rawModule){
     this._children = Object.create(null)
     this._rawModule = rawModule
     const rawState = rawModule.state
     this.state = (typeof rawState === 'function'?rawState():rawState)||{}
   }
}
```

在这里 Module 类是作为树节点存在，用来存储节点信息。这里的树的构建设计中，使用对象的 key 组成 path 来组织节点关系。在一个 js 对象的中序遍历中，存储 key 形成节点的路径 path，类似于 DOM 的 xpath，由此我们就能很方便地找到节点的父节点。

```javascript
let a = {
	state:{},
  modules:{
  	b:{
     	modules{
      	c:{
      		state:{}
    		}
    	}
    }
	}
}
// 那么 c 模块的 path 就是 ['b','c']。从根模块遍历 path.slice(0,-1) 即 ['b'] 就能找到 c 的父模块
```

## 属性初始化

```javascript
class Store{
	constructor(options){
    this._commiting = false
    this._actions = []
    this._actionSubscribers = []
    this._mutations = []
    this._wrappedGetters = Object.create(null)
    this._subscribers = []
    const {dispatch,commit} = this
    const store = this
    this.dispatch = function boundDispatch(type,payload){
      dispatch.call(store,type,payload)
    }
    this.commit = function boundCommit(type,payload,options){
      commit.call(store,type,payload,options)
    }
    // 注意，这里必须先将 commit，dispatch 函数先取出来。
    /* 如果写成 this.dispatch = function(){
    		this.dispatch.call()
    	}
    	则相当于自己调用自己，造成无限循环
    	a(){
    		a()
    	}
    	之所不用 bind 方法，我觉得是因为在使用 new 进行函数调用，this 的指向依然不是 store，因此上面这种写法是最稳定的写法
    */
  }
}
```

## 模块安装过程

这个过程主要做的事情有，递归生成纯净，响应式的 state 对象和一一安装模块。

模块安装的过程是将 mutations，actions，getters 一一注册到 store 到过程，以下以 mutations 的注册过程为例。为了让模块之间互不干扰，mutations 等这些函数在注册的过程中使用模块的 path + 函数名来形成一个独一无二的 key。那么为了方便调用，在 installModule 的过程中，注册 mutations 时，会对原本的 commit 方法进行封装，来固定住 path。因此我们在注册时 mutations 传入的 commit 其实是封装好 path 的 commit ，而我们直接通过 store.commit 或则 store.dispatch 则需要自己手动拼接上路径。

```javascript
let rawStore = {
	modules:{
		userModule:{
			mutations:{
				setUser(){}
			},
			modules:{
				personModule:{
					mutations:{
						setPerson(){}
					}
				}
			}
		}
	}
}
/*
store._mutations = {
	"userModule/setUser":[fn],
	"userModule/personModule/setPerson":[fn]
}
store 内部则这样存储 mutations。调用时只需要根据 path 就能找到对应的 mutation。actions 和 getters 基本像类似。
*/

```

### install Mutation

```javascript
const namespace = getNamespace(path)	
let local = makeLocalContext(store,namespace,path)
module.forEachMutation((key,mutation)=>{
  let namespacedType= namespace+key
  registerMutation(store,namespacedType,mutation,local)
})
```

local 其实就是根据 namespace 对原本的 state，getter，commit，dispatch 方法进行封装。换句话说，创建属于当前模块的 commit，dispatch，state，getters。从而使我们访问数据，提交数据都是基于当前的模块。创建的过程也很简单，对于 commit 和 dispatch，无非在传进来的 type 加上namespace，从而找到存储在 store 上的方法。对于 state 而言，需要根据 path 来访问模块的 state。对于 getters 而言，由于 getters 比较特殊，不同于 state，它的存储方式是拍平的，使用 namespace+key 的形式来组织。因此会使用一个对象来代理 getters 的访问。

```javascript
function makeLocalContext(store,namespace,path){
  const noNamespace = namespace ===''
  let local ={
    // 传入的 type 加上 namespace
    dispatch:noNamespace?store.dispatch:(type,payload)=>{
    	type = namespace+type
    	return store.dispatch(type,payload,options)
  	},
    commit:noNamespace?store.commit:(type,payload)=>{
     	type = namespace+type
     	return store.commit(type,payload)
    }
    // 为了直观，简化分支逻辑
  }
  Object.defineProperties(local,{
    state:{
      get:()=>{
        return getNestedState(store.state,path)
        //从根state，按照 path 访问到当前 state
      }
    },
    getters:{
      // 创建代理对象，由代理对象提供对于 getters 的访问
     	get:noNamespace?store.getters:makeLocalGetters(store,namespace)
    }
  })
}
function getNestedState(state,path){
  return path.reduce((cState,key)=>cState[key],state)
}
function makeLocalGetters(store,namespace){
  let getterProxy = {}	
  let splitPos = namespace.length
  //以命名空间的长度作为分割点，对 store.getters 的所有 key 进行切割，若前面部分等于 namespace 那么
  //就是属于这个命名空间的。后面部分则是 key
	forEachValue(store.getters,(getter,type)=>{
    if(type.slice(0,splitPos)!==namespace)return;
		// 不属于当前命名空间则返回
    let localType = type.slice(splitPos)
    
   	Object.defineProperty(getterProxy,localType,{
      //定义当前 getterProxy 到 store.getters 的访问
      get:()=>store.getters[type],
      enumerable: true
    })
  })
  return getterProxy
}
```

```javascript
function registerMutation(store,type,handler,local){
  let entry = store._mutations[type] ||(store._mutations[type]=[])
  entry.push(function mutationWrapper(payload){
   	handler.call(store,local.state,payload)
  })
}
// actions，getters 的注册类似，函数柯里化，固定住每一个 handler 的 state 参数。在 commit 调用的时候就很方便地调用。
```

installModule 最后是递归安装子模块的过程。将父 path 拼上子 path 就能形成子模块的完整 path。

```javascript
module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
})
```

### ResetStoreVM

resetStoreVm 是建立响应式 store 的过程。在这个过程建立 getters 和 state 的联系，无非就是 data 和 computed 的关系，因此使用 Vue 来建立这个两个之间的联系

```javascript
function resetStoreVM(store,state){
  const wrapperGetters = store._wrapperGetters
 	const computed = {}
  store.getters = {}
  forEachValue(wrapperGetters,(getter,key)=>{
    //将 getters 存储到 computed 对象
   	computed[key] = partial(getter,store)
    Object.defineProperty(store.getters,key,{
     	get:()=>store._vm[key],
      enumerable:true
    })
  })
  store._vm = new Vue({
    data:{
      $$state:state
    },
    computed
  })
  this.enableStrictMode(store)
  // 开启严格模式
  
  // destroy old vm
  
}
function partial(fn,store){
  return function(){
    return fn(store)
  }
}
```

### enableStrictMode

enableStrictMode 会为 _vm 的 state 设置一个 watcher。在 state 改动时，如果 _commiting 不为 true 的话，则会抛出一个错误。

```javascript
function enableStrictMode(store){
  store._vm.$watch(()=>{
    return this._data.$$state
  }),
  ()=>{
    if(this._commiting!==true){
      throw 'not commit by other way'
    }
  },{
    deep:true,
    async:true
   }
}
```



