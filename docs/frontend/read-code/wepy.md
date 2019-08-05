# Wepy

## 安装

1. 要运行 wepy 项目必须安装它的 cli。项目的编译逻辑都写在了 cli 里面。而 wepy-cli 给了只是用来初始化项目的错觉，导致新的环境在不需要初始化项目的情况下常常忘了安装 cli 而导致项目跑不起来，将 cli 作为项目依赖又感觉cli的项目初始化功能很冗余。。。。。。。。。。。。

## 错误处理

1. wepy 即使引用了不存在的组件也会继续编译。导致后续的 log 把前面的错误掩盖了，从而忽略的报错。
2. 在 wxml 区域使用了不存在的组件的时候也不会有错误提示，而是当成自定义标签直接渲染。
3. 组件中的 props 的初始值不满足检测条件的话，会直接忽略这个 props，注意即使你后续更改传入的值符合检测条件，这个 props 也不会再生效，所以注意 props 的初始值。
4. data 中存在相同 props 的 key 时，也不会报错，只会忽略传递进来的 props。
5. 依赖检测只存在编译阶段，不存在于运行阶段，也不有错误提示。因此注意不要频繁更改文件位置
6. 总结一句话，wepy 基本吞了错误，没有达到预期效果只能仔细阅读文档和检查代码了。
7. wepy 编译阶段识别模块否为一个组件的方式并非是根据继承的类来判断，而是在你的组件是否放在 components 目录下，如果你的文件路径包含 components 目录，那么就认为是一个组件。所以组件尽量放在 components，wepy 会针对 component 做一些处理，不然会出现什么错误也不清楚。

## Watch 文件 

小程序的 watch 只是监听所有文件的改动，在 src 里面找出所有依赖当前的文件的文件。寻中依赖的过程即读取 src 里面所有的文件，用正则 import xxx from 'xxx'去匹配所有文件内容，得到文件的路径解析后和当前更改的文件路径进行比较，若相同则说明这个文件依赖于当前更改的文件。并且检测到依赖的文件路径里面包含 components 的话，还有进一步递归寻找依赖。并且最为关键的一点

```javascript
return _util2.default.unique(parents).filter(function(v) {
      return v.indexOf("components") === -1;
});
```

查找完所有依赖，它会排除掉路径里面含有 components 的文件。这意味着当组件依赖于组件时，被依赖的组件的更新不会触发依赖组件的重新编译。这个步骤会导致一些问题，如当被依赖组件位置移动时，依赖组件没有重新编译，自然不会检测到错误，也不会有错误提示，这时的后果无非是把你的自定义组件当前自定义标签来渲染。有时也可能导致样式不生效问题（这个遇到过，不太清楚是否时这个问题导致的）。

## 组件

1. wepy 中的组件都是静态组件，并且是以组件的 id 作为唯一标识符。（官方说法）这是由于wepy 的数据访问机制导致的。编译阶段会把组件的 wxml 递归查找加入到非 componets 的容器中，一般来说是 page，然后通过组件 id 拼接成 path 来访问数据。这种将嵌套的组件结构拍平，拼接 path 来访问数据导致我们在使用同一组件，只能用不同的 id 形成不同的 path 来访问不同的数据。组件的构造函数是有生成不同的 data，computed 的，导致数据混乱还是因为在编译阶段处理得过于简单。

```javascript
 components = {
            //为两个相同组件的不同实例分配不同的组件ID，从而避免数据同步变化的问题
            child: Child,
            anotherchild: Child
   };
```

```vue
components={
	comp:Comp,
	comp2:Comp
}
<template>
  <comp></comp>
	<comp></comp>

	<comp2></comp2>
</template>

// 编译后
<view>
  <!--
		很显然访问数据的方式是通过拼接组件 id 形成一条 path 来访问。如果想访问不同 data 只能使用不同 id，形成不同的 path
	-->
	<view wx:if="{{$comp$isShow}}"></view>
  <view wx:if="{{$comp$isShow}}"></view>
  <view wx:if="{{$comp2$isShow}}"></view>
</view>

```

2. Repeat 循环组件

wepy 在编译阶段会忽略掉组件的 wx:for。因此要循环一个组件必须使用它 repeat 标签。注意，即使你使用了 repeat 标签循环组件，组件的数据仍染是通过 path 来访问的，因此循环的组件仍然访问相同的 data。repeat 标签无非在外部包裹了一层 wx:for。因此不想用 repeat 的话，可以尝试

```vue
<block wx:for="{{[1,2,3]}}" wx:key="key">
	<comp></comp>
</block>
```

效果基本相似

3. 事件机制

wepy 是以组件树的形式来组织，app 为根节点，每个组件会有 \$com 存储子组件实例，以及 \$parent 属性来指向父组件实例，由此组织起一颗组件树。事件的基本机制很简单，父组件在 \$on 的时候，将事件名以及处理事件相关函数信息存在自己的 events 里面。子组件在 emit 的时候从父组件 this.\$parent.\$events 或者 events 里取得对应的事件的处理函数，然后进行调用。

自定义事件有两个注意事项

1. wepy 的组件自定义事件必须要用 .user 修饰符来修饰，否者不会存储到 $events 里面，也就无法捕获。这是与 vue 不同的。
2. 在 wxml 用@xxx.user 注册的事件和使用组件的 events 注册的并不一样。用修饰符注册的存储在 $events 里面，存储在带有组件名的空间下。因此其他子组件的即使发射相同事件也无法触发对应的函数。而有 events 包含组件名， 则是任意子组件只要有相同的事件名就能触发，并且还会递归触发父组件的相同事件名。这一点是由 emit 的逻辑决定的。

```vue
<parent>
	<child @do-some.user="handlerDo"></child>
</parent>
// $events 大概这样 
parent.$events ={
	'child':{
		'v-on:do-some':'handleDo'
	}
}

// events 即不带组件名存储
parent.events={
	'do-a':''
}

```

4. props 传值

子组件的 props 字段是由开发者进行定义，主要定义了接收什么类型的值。父组件的 $props 则是定义了哪个子组件怎么引用了父组件的哪些值。如下所示

```
//child
props = {
	'user':{
		type:Object
	}
}
//parent
<child :user.sync="user"></child>
parent.$props = {
	'child':{
		'user.sync':'user'
	}
}
```

子组件在初始化的时候，会根据自己的 props 配置从父组件取值。取值的前会进行校验，校验成功的会存放在$mappingProps 中存放映射。取值成功的话，data 里面又没有这个props 的 key 的话，就会把数据设置到 data 里面。因此其实 data 和 props 是混在一起的，只是来源不一样而已，而在设置 props 会有许多检测，任意一个不通过的话都拿不到 props 值，当然也不会报错，甚至不知道为什么错。

子组件的 props 和父组件 data 的响应式逻辑写在 \$digest 方法中。暴露的 \$apply 也主要是调用 \$digest 方法，在 digest 方法中，会对 computed，watch 进行检测和调用，也会更新子组件 props 值。重点在于更新 props 值的时会去 $mappingProps 里面取映射，由初始化时检测不通过，没有在 mappingProps 里面存映射，自然无法更新。后续就算父组件的数据符合条件了，也无法更新子组件的数据了。

# 总结

wepy 使用起来体验很差，针对体验差的部分对其代码进行下思考，大致得出以上结论。第一次使用这个框架，可能还是有些错误的地方，欢迎补充和纠正。