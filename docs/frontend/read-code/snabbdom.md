# snabbdom 解析
> 分析 Snabbdom 的源码构成，理清虚拟 DOM 的编写和应用思路，相对于 Vue 等虚拟 dom 源码，Snabbdom 的目的更单一，也更加容易阅读。
## Virtual DOM 

### Virtual DOM 简介

Virtual DOM 是一个能够直接描述一段 HTML DOM 结构的 JavaScript 对象，我们可以直接根据 Virtual DOM 描述的结构渲染创建出唯一确定的 HTML DOM 结构。从整体上看，Virtual DOM 的交互模式减少了 MVVM 或其他框架对 DOM 的扫描或操作次数，并且在数据发生改变后只在合适的地方根据 JavaScript 对象来进行最小化的页面 DOM 操作。Virtual DOM 在 DOM 的操作上有一定的优化，体现在 DOM 操作的优化上。如果仅仅只是 DOM 操作优化并体现不了 Virtual DOM 的价值，毕竟我们也可以通其他方式来优化 DOM 操作，并且 Diff 也需要一定的性能开销。Virtual DOM 真正的价值体现在

1. Virtual DOM 为函数式的 UI 编程方式打开了大门
2. Virtual DOM 可以渲染在 DOM 以外的 backend，也就是渲染到不同端，如移动端，小程序端等。

### Virtual DOM 节点格式

虚拟 DOM 树就是一个 JavaScript 对象，它是由许多个格式相同的树节点组成，理清虚拟节点的组成格式，对于理解虚拟 DOM 树有很大的帮助

```typescript
interface IVNode{
  sel:string | undefined
  data: IVNodeData | undefined
  children: Array<IVNode> | undefined
  elm: Node | undefined
  text: string | undefined
  key: Key | undefined
}
```

1. sel 是一个 CSS 选择器，在创建实际 DOM 节点的时候会用到。如 div,div.cls,div#id
2. data 字段存储各种各种信息如，css 的 class，style，hook 生命周期钩子等，主要用于在创建真正的 DOM 元素的时候，提供给模块使用，用来装饰 DOM 节点
3. children 就是子节点，是一个数组
4. elm 是一个指向真正 DOM 元素的指针
5. text 是一个字符串，是一个文本节点
6. key 是用标示一个虚拟 DOM 的标识符，key 的真正用途在于告诉 Virtual DOM 数据变化时去复用 DOM 元素。比如一个数组 a1 渲染成一组 DOM 列表，我们在之后的使用 API 又请求了一批数据 a2，那么 a1!==a2,但是 a1 可能和 a2 只是一些简单的内容不一致，我们希望复用 DOM 元素，那么就可以使用 key，只要 a1.item.key === a2.item.key 那么就会复用 DOM 元素。在如何判断两个节点是否为相同的节点时，就是用 v1.sel===v2.sel&&v1.key === v2.key

### 生成一个虚拟节点

```typescript
function vnode(sel:string,data:any,children:IVNode[],text:string|undefined,elm:Element|Text):IVNode{
  // Element 是普通节点，Text 是文本节点
  const key = data&&data.key
  return {
    sel,
    data,
    children,
    elm,
    text,
    key
  }
}
```

生成一个虚拟节点，即是把所有传入的属性包在一个对象内即可

### 树的遍历

在虚拟 DOM 树的创建和更新，都会递归地去查找各个节点，并且决定是否更新节点，在 Snabbdom 中常用的是深度遍历的方式，大致的格式如下

```typescript
function traverseTree(node){
  console.log('begin',node.data)
  const child = node.children
  if(child&&Array.isArray(child)){
    for(item of child){
      traverseTree(item)
    }
  }
  console.log('finish',node.data)
}
function vnode(data,children){
  return {
    data,
    children
  }
}
let v1 = vnode(1)
let v2 = vnode(2)
let v3 = vnode(3,[v1,v2])
let v4 = vnode(4)
let v5 = vnode(5,[v4,v3])
iterateTree(v5)
```

由于在创建和更新的时候也是采用了上面的遍历步骤，因此总是会先创建子节点，调用子节点的钩子，然后再创建当前节点

## Snaddom 实现

要实现一个虚拟 DOM 的库，大概要以下几个步骤

1. 定义虚拟节点的格式
2. 实现 createElement 方法，用于将虚拟DOM 树，转换成真正的节点，其大概的实现方式也就是递归遍历虚拟 DOM 树，然后根据配置递归创建 DOM 树。
3. 实现 patchNode 方法，用于对比两个虚拟 DOM 树，并对其 DOM 进行更新。然后判断子节点的差异，调用 patchChildren 去对比和更新子节点
4. 实现 patchChidren 方法，用于比较虚拟 DOM 的子节点之间的差异，并对其进行更新。因为 children 是一个数组，会出现数组顺序改变，数组节点新增等情况，为了优化子节点之间的更新，需要实现一个独立的算法，用来优化子节更新。
5. 最后实现 patch 方法，用来处理各种传入的参数的差异。只是一些简单的判断逻辑。

### 解析

从官网上的例子开始，看看 Snabbdom 做了哪些事情

```typescript
var snabbdom = require('snabbdom');
var patch = snabbdom.init([
  require('snabbdom/modules/class').default,
  require('snabbdom/modules/props').default, 
  require('snabbdom/modules/style').default, 
  require('snabbdom/modules/eventlisteners').default,
]);
```

 上面的代码中，使用 snabbdom 的 init 方法，并返回了一个 patch 方法。init 的参数数组里面包含一系列模块，这些模块其实都是只是简单的 JavaScript 对象，这些模块是由 snabbdom 的生命周期的一些回调函数组成，比如在 class 模块中，其实就是一个 {create:()=>{},update:()=>{}} 这样的一个对象，在元素创建时，会调用 class 模块注册 create 方法，这个时候就可以把 class 加在 dom 上，update 的时候，就可以做移除旧的样式类，并且添加新的样式类。 

#### init 方法

init 方法主要做了几件事情

1. 收集不同模块生命周期回调函数，并把他们都保存在一个对象中，如 cbs = {create:[...],update:[…]}，在对应操作的时机就会遍历这些生命周期并进行调用
2. 初始 DOM 操作 api，dom 操作 API 可以由 init 的第二参数传递进去，也可以使用默认的 html 操作 api，为了浏览器的兼容问题，我们可以自己传递一些写好 dom api，只要实现对应的接口即可
3. 定义一些操作 api，其中比较重要的有 patchVnode 方法，用来对比两个虚拟节点，并进行更新，同时也会对子节点进行更新，可以理解为会对一颗子树进行比较更新。patchChildren 用来对于虚拟节点的 children 数组进行对比和更新。
4. 定义 patch 方法，并返回 patch 方法。patch 方法主要用来处理传入的参数问题和调用一些生命周期。在上面的辅助方法中，都会在合适的时机去调用对应的生命周期函数

### Init 方法

```typescript
const hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];
function init(modules:Array<Patial<Module>>,domApi?:DOMAPI){
  const cbs:ModuleHooks = {}
  for(lifeCircle of hooks){
    cbs[circle] = []
    for(module of modules){
      if(module[lifeCircle]){
        cbs[lifeCircle].push(module[lifeCircle])
      }
    }
  }
  // 生命周期的回调收集，其实就是遍历所有模块，并把他们的回调存储起来,这种方式同样值得我们借鉴
  return function patch(oldNode:Element|IVnode,vnode:IVNode):IVNode{
    const insertedVnodeQueue:IVNode[] = []
    // 定义了一个数据，使用数组存储插入过 VNode，主要用于在 DOM 插入之后，触发 insert 钩子
    for(pre of cbs.pre){pre()} // 调用 pre 生命周期钩子
    
    // 所有 DOM 元素都会挂在 Vnode 的 elm 属性下，如果是一个元素的话，那么就给他一个空 Node
    if(!isNode(oldNode)){
      oldNode = emptyNodeAt(oldNode)
    }
    // 如果是相同的节点，那么使用新节点去更新旧节点
    if(sameNode(oldNode,vnode)){
      patchNode(oldNode,vnode,insertedVnodeQueue)
    }else{
      // 如果不是相同节点，那么重建 DOM 树
      const elm = oldNode.elm
      createElement(vnode,insertedVnodeQueue)
      const parent = api.parent(elm)
      if(parent !==null){
        api.insertBefore(parent,vnode.elm,api.nextSiblings(elm))
        api.removeNodes(parent,[oldNode],0,0)
      }
    }
    // 调用 insert 生命周期钩子
    for(let item of insertedVnodeQueue){
      item.data.hook.insert(item)
    }
    // 调用 post 生命周期钩子
    for(let item of cbs.post){
      item()
    }
  }
}
```

### patchVnode 方法

patchVnode 方法也比较简单，主要做了以下几个事情

1. 调用 prepatch 生命周期钩子

2. 调用 update 生命周期钩子

3. 比较更新节点，主要逻辑如下

   1. 新的节点不是一个文本节点的话。

       如果都定义了子节数组，那么调用 updateChildren 来更新子节点

      ​    如果只定义了 newVnode 的 children，说明为新增子节点，调用 addNodes 方法，把子节点插入，如果存在旧节点定义 text，那么旧节点是一个文本节点，需要把 text 也清除掉

      ​    如果只定义了 oldVNode.chidren 那么说明这种情况为删除节点，调用 removeNodes 把子节点删除

      ​    最后一种情况，就是 oldVNode.children,newVNode.children 都没定义，新节点又不是一个文本节点，那么即是需要删除旧的文本节点了

   2. 第二种情况就是新节点是一个文本节点了，比较并更新文本，然后如果 oldVnode 定义了 children 那么把子节点删除

4. 调用 postpatch 钩子

### patchChildren

patchChildren 方法比较复杂，需要比较两个 vnode 数组之间的差异，并进行合适的更新，首先分别使用两个指针指向旧节点和新节点的首尾，然后使用循环来移动指针，达到去除两个数组首尾为 null 的元素。比较 首首，尾尾，首尾，尾首 元素是否相同，如果是那么使用 patchNode 对这两个元素进行更新，并对指针进行合适的移动。

上面的比较主要是处理元素顺序的问题，例如如果只是列表的顺序变为相反的话，那么上面的尾首比较就能识别出来，调用 patchVNode 更新节点，然后使用 insertBefore 把列表最后一个 DOM 元素插到第一个前面就可以了。如果上面比较失败的话，那么就使用 key 取判断旧节点里面是否存在着相同的 key，如果存在的话，进行更新和插入，不存在就创建插入

最后通过比较旧节点的首尾指针，和新节点的首尾指针来判断是进行增加节点操作还是删除节点操作



### 总结

以上就是 Snabbdom 的一些主要内容，整体逻辑并不难，比较有难度的地方就在 patchChildren 这一块的算法中。Snabbdom 这个库的主要功能就是比较两个 VNode 之间的差异，并对 DOM 进行合适的更新。

