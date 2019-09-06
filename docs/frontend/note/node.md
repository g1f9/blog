# Node 深入浅出

## 模块机制

### CommonJS

#### CommonJS 的出发点

后端 JavaScript 存在以下缺陷

1. 没有模块系统
2. 标准库少。没有文件系统，IO 流等标准 API
3. 没有标准接口
4. 缺乏包管理系统

CommonJS 规范的提出主要是为了弥补当前 JavaScript 的缺陷，以达到像 Java 那样具备开发大型应用的基础能力。

#### CommonJS 模块规范

##### 模块引用

```js
var math = require('math')
```

通过使用 require 方法，接受一个模块标识符，从而将一个模块的 API 引入到当前模块上下文

##### 模块定义

上下文提供了 exports 用于导出当前模块的方法和变量。注意 exports 是 module.exports 的一个引用。真正具备返回的结果是 module.exports，因此如果修改 exports 的引用，会得不到你想要的结果。因此当需要更改 exports 时，需要使用module.exports

```js
exports.add = (a,b)=>a+b
// 正确
exports = {add:(a,b)=>a+b}
//错误
module.exports = {
  add:(a,b)=>a+b
}
// 正确
```

##### 模块标识

模块标识就是传递给 require 的参数，必须是符合小驼峰命名的字符串，可以是相对路径，绝对路径。模块标识在寻找模块的过程起了很大的作用，它决定了怎么去定位模块的位置。

### Node 模块实现

Node 模块的引入经历了以下三个步骤

1. 路径分析
2. 文件定位
3. 编译执行

Node 模块分为两类

1. 核心模块。在 Node 编译的过程中，编译进了二进制文件，在 Node 进程启动时核心模块直接被加载进了内存中。因此没有路径分析和文件定位，并在路径优先级中优先判断
2. 文件模块则是用户自定义模块，需要经历完整路径分析，文件定位和编译执行。并且 Node 会缓存执行完的结果，注意缓存的是编译执行完的结果，也就是 exporst

不管是核心模块还是文件模块，require 对于相同模块的**第二次加载都一律采用缓存优先的方式**

#### 路径分析和文件定位

##### 模块标识符分析

模块标识符大概分为以下几类

1. 核心模块。优先级仅次于缓存加载。
2. 路径形式。相对路径和绝对路径都会转为真实路径定位文件位置
3. 自定义模块。以**模块路径**形式查找模块。所谓模块路径，即 Node 在定位文件模块时所使用的一套策略。具体规则即从当前文件所在目录的 node_modules 开始，沿着路径逐级向上递归查找父目录的 node_modules，直到根目录。例如 /a/b/test.js，那么查找规则为 [/a/b/node_modules,/a/node_modules,/node_modules]

##### 文件定位规则

- 文件扩展名分析。标识符中允许出现不包含扩展名的情况，Node 会依次尝试 .js,.json,.node。
- 目录和包分析。若查找结果为一个目录，那么会将目录当前一个包来处理。首先查找 package.json，取出 mian 字段进行定位。定位失败则将 index 当作默认扩展名，依次尝试 index.js，index.json，index.node。否则抛出异常

#### 模块编译

编译和执行是模块引入的最后一个阶段。定位到具体文件后，**Node 会新建一个模块对象**，这个模块对象就是我们经常访问的 module 对象，这个对象也用于缓存执行结果。根据路径载入并编译，对于不同的扩展名，载入方式也不一样。

- .js 通过 fs 模块同步读取后编译执行
- .json 通过 fs 读取后使用 JSON.parse 解析返回结果
- .node 通过 dlopen 加载最后编译生成的文件
- 其余扩展名都被当前 js 引入。

模块编译的规则定义在 **Module._extensions** 上，而 Module._extensions 会被赋值给 require.extensions，因此我们可以通过在 require.extensions 来自定义模块加载方式

```js
Module._extensions['.json'] = function(module, filename) {
  var content = NativeModule.require('fs').readFileSync(filename, 'utf8');
  try {
    module.exports = JSON.parse(stripBOM(content));
  } catch (err) {
    err.message = filename + ': ' + err.message;
    throw err;
  }
};
```

##### JavaScript 模块的编译

JavaScript 模块在编译的过程中，会对文件内容进行首尾进行包装，形成一个函数进行作用域隔离，最后将当前模块对象的 exports，require，module 传递给这个函数执行。最后再返回 module.exports 

```js
// 编写的模块
module.exports = {add:(a,b)=>a+b}

// 包装后
(function(exports,require,module,__filename,__dirname){
  module.exports = {add:(a,b)=>a+b}
})

// require 执行过程

function require(pathId){
  let cacheModule = Module._cache[pathId]
  if(cacheModule) return cacheModule.exports
  let module = new Module(pathId)
  Module._cache[pathId] = module
  module.load(pathId)
  // load 的过程，读取 js 文件并包装，使用 runInThisContext 包装函数，
  // 将 module 的各个参数传入并执行函数，这样我们的赋值就绑定到 module 上
  return module.exports
}
```

##### C++ 模块

使用 process.dlopen 进行加载和执行，dlopen 在 Windows 和 Linux 有不同的实现并使用来 libuv 进行兼容封装。.node 模块不需要编译，因为它是 C++ 编译后生成的，只有加载和执行，执行过程中和 exports 产生关联，返回给调用者。

##### Json 模块

使用 JSON.parse 对 fs 读取的字符串进行调用返回。

### 核心模块

核心模块的 JS 代码会经过转换**以字符串的形式**存储在 C++ 代码的命名空间下，此时是不可执行的。在启动 Node 进程的时，JavaScript 代码直接加载进内存中。在加载的过程，经历标识符分析后直接定位到内容中，比普通的文件模块从磁盘查找要快得多。在引入 JS 核心模块的过程中，也经历了头尾包装的过程，与文件模块的差别在于获取源码的方式以及缓存执行的结果位置。核心代码通过 process.binding('natives') 取出，编译成功缓存到 NatvieModule._cache 上，文件模块则缓存到 Module._cache 上。

## 异步 IO

### 阻塞和非阻塞 I/O

阻塞 IO 和非阻塞 IO 是相对于系统调用而言。在调用阻塞IO时，应用程序需要等待I/O完成才返回结果。阻塞I/O的一个特点是，调用之后一定要等到系统内核层面完成所有的操作后，调用才结束。例如磁盘调用，系统内核在完成磁盘寻道，读取数据，复制数据到磁盘后，这个调用才结束。而非阻塞I/O在调用之后，立即返回，无需等待I/O 完成，非阻塞 I/O 返回之后，CPU 的时间片可以用来处理其他业务，性能明显提升。  

非阻塞 I/O 存在一些问题，由于完整的 I/O 并没有完成，立即返回的不是业务层期待的数据，而仅仅是当前的调用状态，为了获取完整的数据，应用程序需要重复调用 I/O 操作来确定操作是否完成。这种重复调用判断的操作是否完成的技术叫做轮询。轮询也在不断地改进以提高效率，现存有以下几种

1. read。重复调用来检查 I/O 状态来完成完整数据的读写。CPU 耗在等待上
2. select。在 read 基础上进行改进，使用文件描述符来判断 read->select->read(数据)
3. poll。使用链表来存储状态，并且能避免不必要的检查。 read->poll->read
4. epoll。是 linux 下效率最高的 I/O 事件通知机制，在进入轮询时没有检查 I/O 事件，将会进行休眠，直到事件发生将它唤醒。真实利用了事件通知机制。 read->epoll(休眠)->read

轮训技术满足了非阻塞 I/O 确保获取完整数据的需求，但是对于应用程序而言，它依然属于一种同步，因为应用程序仍然需要等待 I/O 完全返回。等待期间 CPU 要么用于便利文件描述符的状态，要用于休眠等待事件发生。  

要实现理想的异步 I/O 在单线程下确实有些困难，然而使用多线程来实现异步 I/O 就不是什么难事了。现实中的异步I/O 通过让部分线程进行阻塞 I/O，或者非阻塞 I/O 加轮询的方式来完成数据的获取，让一个线程进行计算处理，通过线程之间的通信将得到的数据进行传递，从而轻松实现异步 I/O。拿 JavaScript 举例子，有 js 线程负责执行 js 代码，js 发起 I/O 调用，就 I/O 线程使用非阻塞+轮询的方式，去读取 I/O，js 继续执行，I/O线程执行完后，再通知 js 线程执行。  

windows 下的 IOCP 提供了理想的异步 I/O，调用异步方法，等待 I/O 完成之后的通知，执行回调用户无需考虑轮训。内部原理采用线程池来模拟。由于平台差异 windows 下，libuv使用 IOCP，而 *nix 则采用自定义线程池

### Node 的异步 I/O

完成整个异步 I/O 环节有事件循环，观察者，请求对象等

1. 事件循环类似与一个 while true 的循环，每一次循环称为一个 Tick，每个 Tick 就是查看有没有事件处理，有就处理，没有就进入下一 Tick
2. 观察者。每个事件循环会从观察者中取出需要处理的事件，因此观察者是收集事件的地方，如网络 I/O 观察者就观察网络请求，并产生网络事件。
3. 请求对象作为信息的载体，在事件循环和观察者之间传递信息。

发起异步调用->封装请求对象->设置参数和回调->将请求推入到线程池中
线程池可用->执行请求对象的I/O 操作->执行结果放在请求对象中->IOCP 通知调用完成->将完成的I/O交给 I/O 观察者
事件循环->从 I/O 观察者获取可用的请求对象->取出回调和结果并执行->结束

### 非I/O异步 API

#### 定时器

setTimeout 和 setInterval。在setTimeout 和 setInterval 创建的定时器会被插入到定时器观察者内部的一个红黑树中。每次 Tick 执行时，从该观察者中取出定时器对象，检查是否超过定时时间，超过就执行回调。

```js
// 贫穷版模拟，没有使用性就是方便理解
class TimeObserver {
  constructor() {
    this.timeouts = [];
  }
  getEvents() {
    let now = Date.now();
    let resultEvent = [];
    for (let i = 0; i < this.timeouts.length; i++) {
      let item = this.timeouts[i];
      if (item)
        if (now - item.create_at > item.time) {
          this.timeouts[i] = undefined;
          resultEvent.push(item.callback);
        }
    }
    return resultEvent;
  }
  register(callback, time) {
    let create_at = Date.now();
    let payload = {
      callback,
      time,
      create_at
    };
    this.timeouts.push(payload);
  }
}

let timeObserver = new TimeObserver();
function selfSetTimeout(callback, time) {
  timeObserver.register(callback, time);
}
function eventLoop() {
  //模拟事件循环
  setInterval(() => {
    let events = timeObserver.getEvents(); //定时器观察者取出有效事件
    for (const item of events) {
      item();
    }
  }, 100);
}

selfSetTimeout(() => {
  console.log("after 1000 second");
}, 1000);

selfSetTimeout(() => {
  console.log("after 4000 second");
}, 4000);
selfSetTimeout(() => {
  console.log("after 7000 second");
}, 7000);
eventLoop();
```

### process.nextTick

nextTick 方法只会将回调放入到队列中，在下一轮 Tick 时取出执行。实现代码如下

```js
process.nextTick = function(callback) {
  // on the way out, don't bother.
  // it won't get fired anyway
  if (process._exiting) return;

  if (tickDepth >= process.maxTickDepth)
    maxTickWarn();

  var tock = { callback: callback };
  if (process.domain) tock.domain = process.domain;
  nextTickQueue.push(tock);
  if (nextTickQueue.length) {
    process._needTickCallback();
  }
}
```

### setImmediate

与 nextTick 相类似，区别在于 nextTick 属于 idle 观察者，setImmediate 属于 check 观察者，setTimeout 采用**类似** I/O 观察者。在每一轮的循环检查中 idle 观察者先于 I/O 观察者，I/O 观察者先于 check 观察者。因此 process.nextTick 会先于 setImmediate 调用。并且 nextTick 的回调函数保存在数组中，setImmediate 保存在链表中，在行为上 nextTick 在每轮循环中回**全部执行完**，在 nextTick 执行的过程中产生的 nextTick 也会一同执行，而 setImmediate 调用回调的过程产生 immediate 并不会在本轮执行，而是会等到下一轮

```js
process.nextTick(() => {
  console.log("n1");
  process.nextTick(() => {
    console.log("n2");
  });
});

setImmediate(() => {
  console.log("s3");
  setImmediate(() => {
    console.log("n4");
  });
  process.nextTick(() => {
    console.log("开始新的一轮");
  });
});

//n1
//n2
//n3
//开始新的一轮
//n4
```

### 事件驱动于高性能服务器

在网络套接字的处理上，Node 也使用了异步 I/O，网络套接字上侦听到到请求都会形成事件交给 I/O 观察者，事件循环不停地处理者些网络 I/O 事件，如果 Js 有传入回调函数，这些事件最终会传递到业务逻辑层进行处理。利用 Node 构建网络 Web 服务器正是基于这样到一个基础上。其基本流程与异步 I/O 模型基本一致。网络请求->请求对象到I/O 观察者-> I/O 观察者处理。事件循环轮询-> I/O 观察处理完成-> 处理请求对象的回调 -> 完成。

## 异步编程

### 异步编程的优势和难点

#### 优势

Node 最大的特性莫过于基于事件驱动和非阻塞 I/O 模型，使得 CPU 与 I/O 并不相互依赖等待，让资源得到更好的利用。

#### 难点

1. 异常处理。同步式的 try catch 对于异步编程而言并不一定适用。异步 I/O 的实现主要包含两个阶段：提交请求和处理结果。这两个阶段中间有事件循环进行调度。异步方法通常在第一个阶段提交请求后立即返回，如果异常不发生在这个阶段，try catch 则不会有任何作用。因此 Node 在处理异常上形成了一种约定，将异常作为回调的第一个参数返回。

2. 函数嵌套。多个回调函数之间相互依赖形成嵌套金字塔，使得代码的维护变得十分困难。
3. 阻塞代码。
4. 多线程编程。Node 借鉴 WebWorkers 模型引入了 child_process
5. 异步转同步。

### 异步编程解决方案

异步编程的主要解决方案有以下三种

1. 事件发布/订阅模式
2. Promise/Deferred 模式
3. 流程控制库

#### 事件发布订阅模式

事件发布/订阅模式可以实现一个事件与多个回调函数的关联，通过 emit 发布事件后，消息会传递给监听器执行。侦听器可以灵活地添加和删除。事件发布/订阅模式本身并无同步和异步的问题，Node 中 emit 调用多半是伴随这事件循环而异步触发的，所以说事件发布/订阅模式广泛应用与异步编程。  
Node 对事件发布/订阅模式做了一些额外的处理。  

- 如果一个事件添加超过 10 个监听器，将会得到一条警告，这是与 JS 单线程运行有关，设计者认为监听器太多可能导致内存泄漏
- 异常处理。如果运行期间触发了 error 事件，则会检查是否有对 error 添加监听器，如果添加则交由监听器处理，否则将异常抛出，如果外部没有捕获则会引起线程退出。

继承 events 模块

```javascript
const EventEmitter = require("events").EventEmitter;
const utils = require("util");

function SelfEmitter() {
  EventEmitter.call(this);
}
utils.inherits(SelfEmitter, EventEmitter);

const bus = new SelfEmitter();
bus.on("ok", () => {
  console.log("ok");
});
bus.emit("ok");
```

利用事件队列解决雪崩问题。所谓雪崩就是在高访问量和并发量的情况下，由于某些原因大量请求无法及时处理，例如大量的相同的数据库查询，影响网站整体的响应速度。利用 events 的 once 一次调用的机制，先将事件存储起来，等待处理完成后将结果给多个回调使用。

多个异步之间的协作方案。很多时候事件和回调可能是多对一的关系，例如一个回调可能需要多个请求完才能进行。这时可以引入一个第三方的函数或者变量来起到门的作用。门的概念类似于守卫，需要达到一定条件才可以通过这个门。例如 Promise.all 和 Promise.race。它们各自的门条件不一样，起到的效果也就不一样来。

<!-- TODU 异步编程后续，太累了，不想写 -->

## 内存控制

### V8 内存分配

在 Node 中使用 JS 就会发现尽管内存充足，却具备一定限制。造成这个问题主要原因是 Node 基于 V8 构建，在 Node 中使用 Js 对象基本都是通过 V8 自己的方式进行分配和管理。V8 限制堆的大小表层原因是因为 V8 最初是为浏览器设计，不太可能遇到使用大量内存的情况，对于网页而言 V8 的限制已经绰绰有余。深层原因是 V8 内存回收机制，V8 做一次小的垃圾回收需要 50ms，一次非增量式垃圾回收需要 1s 以上，因此内存限制得越低，可以避免垃圾回收引起性能和响应下降。

### V8 内存回收

V8 内存采用分代式回收算法。将内存空间分为两部分，新生代和老生代。两个部分分别有各自的回收算法。之所以采用分代式是因为几乎没有任何一种算法可以适用任何场景。新生代的对象存活时间比较短，采用 scavenge 算法，将空间分为两部分，一部分是 to，一部分是 from，在垃圾回收时，把存活对象从 from 复制到 to 中，然后把 to 变为 from，即进行一个翻转。scavenge 是典型的采用空间换时间的算法，对于新生代存活时间较短的对象比较适用。缺点是只能适用一半的空间，优点是简单，而且不会产生内存碎片

在新生代满足一定的条件时就晋升到老生代空间。转移的对象需要满足经历过一次 scavenge 算法，或者新生代的空间已经大于 25%。

老生代中代对象存活时间都比较长。scavenge 算法明显不适用，因此老生代中采用的是 Mark-Sweep 和 Mark-Compact 方法相结合的方式。Mark-Sweep 即标记清除法，Mark-Sweep 遍历堆中所有对象并标记存活对象，随后在清除阶段，清除堆中没有被标记的对象。之所以采用标记清除法是因为在老生代中，死对象只占了小部分。Mark-Sweep 最大的问题在清除过后，内存会出现一片片内存碎片，使得后续的内存分配可能出现问题。因此提出了 Mark-Compact 即标记整理，在整理的过程中，将存储的对象往一边移动，移动完成后，直接清除边界外的对象。

Mark-Compact 需要移动对象，就决定了它的速度比较慢。在V8 中主要适用 Mark-Sweep 算法，只有在内存不足才使用 Mark-Compact 进行整理。

在垃圾回收的过程中为了避免js 逻辑出现问题，因此垃圾回收的3种基本算法都需要将应用的逻辑暂停下来，等待垃圾回收结束后在继续执行。这种情况称为全停顿。在新生代种，对象较少，全停顿也不会造成太大的影响。但是在老生代中，对象比较多，全堆垃圾回收耗时较久。因此引入 incremental marking，即增量标记法。它将原本需要一口气执行完的算法分解为多个小部分来完成。从而减少来全停顿。

### 内存指标

- 查看 Node 进程内存占用。process.memoryUsage()。结果分为三个部分，分别是申请堆总量 heapTotal，堆使用量 headUsed，以及常驻内存 rss。当使用量不足时，就会不停申请新的内存，直到超过 V8 内存限制时，就会报错。
- 系统内存占用。使用 os.totalmem(),os.freemem()
- 堆外内存。可以看到 headTotal 比 rss 要少。这意味者 Node 中内存并发所有都是通过 V8 去分配的，我们将那些不是 V8 分配的内存称为堆外内存。堆外内存不是由 V8 进行分配，比如 Buffer 对象，它不经过 V8 内存分配也就没有 V8 内存最大的限制。

通过以上可知，Node 中内存主要分为通过 V8 分配的部分，和Node 自行进行分配的部分。受 V8 垃圾回收限制主要的是 V8 的堆内存。

### 内存泄漏

内存泄漏主要有以下场景

1. 缓存。Node 端与浏览器端不一样，浏览器的页面属于短期运作，关闭页面内存就能得到释放，而使用内存作为缓存的对象也能得到释放。而 Node 端长期运作，如果不及时释放内存对象中端缓存，随着请求数量的增加，那么就很容易造成内存泄漏。
2. 队列消费不及时。消费能力跟不上生产能力，导致队列堆积过多任务从而产生内存泄漏。
3. 作用域未被释放。常见于闭包。

#### 缓存场景

在 Node 中，一旦一个对象被当作缓存来使用，就意味着它将会常驻在老生代中，存储的键越多，长期存储的对象也就越多，这将导致垃圾回收时，对这些对象的无用功，因此需要控制缓存对象的大小。并且当使用对象作为缓存时，又与严格上的缓存有着区别，普通对象缓存并没有相应的过期策略，并且进程之间无法共享内存，如果在进程内使用缓存，这些缓存不可避免地会产生重复。因此建议采用进程外的缓存，进程本身不存储状态，采用如 Redis，Memcache 等，可以很好解决上述问题。

#### 关注队列状态

队列在消费者/生产者模型中经常充当中间产物。大多数场景下，消费的速度远大于生产的速度，内存泄漏不易产生。但是一旦消费速度低于生产速度，就会产生堆积。这时 JavaScript 中相关的作用域不会得到释放，内存占用不会回落，从而出现内存泄漏。这种场景下，表层的解决方案是使用消费速度更高的技术，需要注意的是在生产速度突然激增，或者消费速度突然降低，内存泄漏还是有可能出现。深层解决方案是监控队列长度，一旦堆积应该通过监控系统产生报警并通知相关人员，另一个解决方案是优化队列结构，列入在队列中加入超时模式和拒绝模式。启用超时模式时，调用加入到队列就开始计时，超时就直接响应一个超时错误，启用拒绝模式时，新来到调用会直接报错。

### 内存泄漏排查

常见的用于定位内存泄漏的应用：

1. v8-profiler
2. node-heapdump
3. node-mtrace
4. dtrace
5. node-memwatch

## 理解Buffer

### Buffer 结构

Buffer 是典型的 Js 与 C++ 相互结合的模块，性能部分由 C++ 实现，非性能部分由 Js 实现。Buffer 是一个类数组对象，每个元素由 16进制来表示，如 <Buffer 68 65 6c 6c>，一个元素一个占用字节，一个字节每4位用 16 进制来表示。Buffer 对象的内存分配不是在 V8 的堆中实现的，而是在 Node 的 C++ 层面实现内存申请的，因此 Node 在内存上的使用策略是 C++ 层面申请 ，Javascript 中分配。

```js
let b = Buffer.alloc(10) // 分配 10 个字节,使用 0 填充
b = Buffer.alloc(10,8) // 使用 8 填充
b = Buffer.from([1,2,3])// 从数组创建
```

#### Slab 分配

为了高效使用内存，Node 采用 slab，一种高效的内存分配机制。slab 可以理解为申请好的一块固定大小的内存。slab 存在 full：已分配，partial：部分分配，empty：未分配三种状态。Node 以 8KB 为界限来区分 buffer 是大对象还是小对象。在 JS 层面也是以它作为单位单元进行内存分配。

1. 小对象(<8KB)。采用的方式是，使用 pool 这个中间变量指向当前 slab，pool 足够时就就使用 pool 进行分配，不足时就新建 slab，并把 pool 指向新的 slab。如 `pool?pool.length-pool.used>buf.length?null:allocPoll()?:allocPool()`。确定好 slab 之后就在 buffer 上记录更改 pool 的相关信息。`buf.offset=pool.used;pool.used+=buf.length;`。这样的分配机制在于，如果先分配 2KB 的 buffer，然后再分配 7 Kb 的 buffer 的时候，7Kb 的 buffer 就只能申请新的 slab，导致 2Kb 的buffer 独占了一个 slab，并且直到这块 2KB 的 buffer 被释放前，空白的内存都处于浪费状态。
2. 大对象。直接分配一个 SlowBuffer 给这个对象。并且大小等于申请的内存大小。`this.parent = new SlowBuffer(this.length);this.offset=0`

简单而言 Buffer 的真正内存是 Node 在 C++ 层面提供的，js 只是使用它。采用 slab 的机制进行预先申请和时候分配，使得 js 到操作系统之间不必有过多系统调用。对于大 Buffer 则直接使用 C++ 提供的内存。

### Buffer 的转换

Buffer 对象可以和字符串之间相互转换，目前支持的编码类型有

- ASCII
- UTF-8
- UTF-16LE/UCS-2
- Base64
- Binary
- Hex

Buffer 转字符主要通过 toString 方法，toString 可以指定一个编码。Buffer 转字符串同样只支持上述编码，可以通过 `Buffer.isEncoding('gbk')` 来判断是否支持某种编码。如果不支持的话，可以通过生态圈的 icon 和 icon-lite 来实现

```js
let buf = Buffer.from('hello') //字符串转 buffer，默认 utf8
Buffer.from('test','latin1') // 指定字符串编码
buf.toString('base64')
```

### Buffer 的拼接

在使用 `+` 运算符号进行拼接 Buffer 的时候，其实是使用了 toString 方法的默认类型转换。如 buf1+ buf2 其实是 buf1.toString()+buf2.toString()，并且使用 utf8 的编码。这意味着当我们连续读一个文件时采用这样的直接拼接方式，很有可能出现字符截断。例如由三个字节构成的字符，有两个字节在 buf1，一个字节在 buf2，他们各自 toString 就容易出现乱码。

解决方案

可读流的 setEncoding。会根据编码方式保留被截断的字节，待后续字节来了，再一起返回。

```js
let rs = fs.createReadStream('test.md',{highWaterMark:11})
rs.setEncoding('utf8')
```

正确拼接 Buffer

使用 Buffer.concat 拼接多个 Buffer，再一起返回。

```js
//Buffer.concat 的实现

```

### Buffer 与性能

1. Buffer 在 Web 运用中，通过预先将静态内容转换为 Buffer 对象，可以有效减少 CPU 的重复使用，节省静态资源。
2. highWaterMark。highWaterMark 设置缓冲期的上限阈值。fs.createReadStream 的工作方式是，先在内存中准备一段 Buffer，这个 Buffer 的最大长度就是 highWaterMark。fs.read 读取时逐步从磁盘中将字节复制到 Buffer 中，完成一次读取就将 Buffer 通过 slice 出一部分通过 data 时间传递给回调。如果 Buffer 用完，则重新分配，否则继续使用。所以 highWaterMark 的设置对 Buffer 有一定影响且影响系统调用的次数。hightWaterMark 的值越大，读取速度越快。若文件过小，highWaterMark 越大会导致预先分配的内存越`浪费。

### 