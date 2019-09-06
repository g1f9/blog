# Babel

## 概述
> 以下论述基于 babel7。在 babel7中，插件名以 @babel 开头

Babel 是一个 JavaScript 编译器，工具链，主要用于将 ES6 版本的代码转换为向后兼容的 JavaScript 语法，以便能够运行在当前和旧版本的浏览器或其他环境中。babel 主要能做以下事情

1. 语法转换
2. polyfill。在目标环境中添加缺失的特性
3. 源码转换
4. more

babel 核心不处理任何代码转换，它只负责将代码转换成 ast，然后将 ast 交给插件去处理。在不使用任何插件的情况下就相当于`(code)=>code`。插件负责语法转换，并且一个插件只负责一类代码转换。例如 @babel/plugin-transform-arrow-functions 负责将箭头函数转换为普通函数，如果你加入了这个插件，编译过后的箭头函数就能输出为普通函数，如果不加入，那么箭头函数将会原样输出。默认不加任何插件的情况下，输出的代码就等于输入的代码。

```javascript
const f= ()=> 1
//./node_modules/.bin/babel src --out-dir lib --plugins=@babel/plugin-transform-arrow-functions
//使用 @babel/plugin-transform-arrow-functions 转换后
const f = function(){
  return 1
}
// 可以看到箭头函数转了，但是 const 没转
```

在上面的例子，使用箭头函数插件，但是他并没有转换 `const`，那么为了转换 const 我们就需要引入另外一个插件。因此为了完整地将 es6 转换成对应 es5 代码需要往配置中加入大量的插件，为了避免这样重复的工作。引入了 preset，即一组预设的插件，由预设来管理我们目标的插件集合。@babel/preset-env 可以根据我们配置的目标环境提供一组对应插件。

```js
npm install --save-dev @babel/preset-env
./node_modules/.bin/babel src --out-dir lib --presets=@babel/preset-env
```

上述预设默认情况下支持所有最新的 JavaScript 特性。

@babel/preset-env 也支持 polyfill，可以自动根据使用情况自动和目标环境自动引入对应的文件，传入 useBuiltIns，和对应的 corejs 参数即可。@babel-core+@babel/preset-env 已经能很好工作了，但是在编译过后的文件中，存在大量重复定义的帮助方法，会影响最后的整体体积。为了进一步优化，引入 @babel/plugin-transform-runtime 这个插件。默认情况下这个插件可以把这些内联的帮助函数定义改成从 runtime/helpers 中引入。当然这个插件也不只这个功能。

### 简单案例

`yarn add @babel/cli @babel/core @babel/preset-env @babel/plugin-transform-runtime -D`

`yarn add core-js@3`

```js
// 项目根目录
//.babelrc
{
  "presets":[["@babel/preset-env",{"useBuiltIns":"usage","corejs":3}]],
  "plugins":["@babel/plugin-transform-runtime"]
}

//package.json
{
  "scripts":{
   "compile":"babel src --out-dir dist"
  }
}
```

`npm run compile`

## @babel/preset-env

@babel/preset-env 是一个十分灵活的预设，它使我们能够使用最新 JS 语法特性，又避免需要我们去手动配置那些细微的语法转换，也支持根据对应的环境进行 polyfill（需要配置）。@babel/preset-env 的开源得益于众多的优秀的开源项目，例如 [browserslist](https://github.com/browserslist/browserslist)，[compat-table](https://github.com/kangax/compat-table) 和 [electron-to-chromium](https://github.com/Kilian/electron-to-chromium)，从这些开源项目获取数据，来获取对应目标环境的 JavaScript 语法特性，从而更好的进行语法转换和 polyfill。

### browserlist 集成

对于浏览器或者基于 Electron 的项目，推荐使用一个 .browserlistrc 文件来指定目标环境，许多工具也使用了这个文件，例如 autoprefixer，stylelint，eslint-plugin-compact 等。若果没有配置 target 或者 ignoreBrowserlistConfig，那么 preset-env 就默认使用 browserlist 的源配置。

#### 案例

##### browserslist

浏览器市场份额大于 0.25%，（忽略没有安全更新的浏览器，例如 ie10 和黑莓）。具体的配置方式可以参考 [browserslit](https://github.com/browserslist/browserslist#queries) 的文档

```
> 0.25%
not dead
```

### Options 配置

**`targets`**

`string|Array<string>|{[string]:string}`,默认 `{}`

描述项目支持的浏览器环境

可以是兼容 browserslist 的查询

```json
{
  "targets":">0.25%,not dead"
}
```

也可以指定某种浏览器的最小版本支持

```json
{
  "targets":{
    "chrome":"58",
    "ie":"11"
  }
}
```

如果没有指定没有对应的 target，@babel/preset-env 默认将会转换**所有**的 **ECMAScript2015+** 的代码。
>不推荐这样使用 preset-env，这样无法发挥出它指定浏览器转换的优势。特别是开启 polyfill 属性时，一定要指定这个 target 属性，否则引入的 polyfill 将会非常多

其他 targets 的配置

1. `targets.esmodules`。 用来指定目标环境是否支持 es6 的模块机制，开启的话 browsers将会被忽略
2. `targets.node`。编译成 node 版本，可以选值`string|"current"|true`
3. `targets.safari`。编译成 safari 的预览版本。
4. `targets.browsers`。`string|Array<string>`，使用 browerserslist 的查询语句，例如 `last 2 versions,>5%,safari tp`。

**`debug`**

`boolean`，默认 `false`

输出使用的 targets/plugins 和 插件支持版本信息到控制台

**`useBuiltIns`**

1. useBuiltIns:'usage'。不需要在 webpack.config.js 的任何入口或者代码引入 polyfill。将会自动分析用到的 API，然后在对应的文件自动引入。相当于自动的 require 或者 import
2. useBuiltIns:'entry'。需要在源码的最顶部通过 import 或者 require 引入，类似上面的直接引入。多次引入会报错
3. useBuiltIns:false。在 webpack.config.js 中，通过入口引入。如 module.exports = {entry:['@babel/polyfill','./app/js']}

**`forceAllTransforms`**

`boolean`，默认 `false`

默认情况下，这个预设将会运行目标环境所需要的所有转换。当输出需要通过 UglifyJs 或者一个完全只支持 ES5 的环境，这个选项将会很有用

**`configPath`**

`string`，默认 `precess.cwd`

指定搜索 browserslist 的起始目录，会不停向上搜索直到根目录

**`shippedProposal`**

`boolean`，默认 `false`

启动对于浏览器中内置特性的支持，例如目标浏览器支持一些比较新的语言特性，并且有着更好的表现，可以通过开启这个选项来避免进行代码进行转换。

**`ignoreBrowserslistConfig`**

`boolean`，默认 `false`

是否忽略 browserslist 的配置。开启时不会检索 browserslist，

另外还有 `spec`，`loose`，`include`，`exclude`。`include/exclude` 用来添加/移除某些插件。`loose` 编译时启用宽松模式，`spec` 启用更符合规范的编译。

## @babel/plugin-transform-runtime

这个插件做以下几件事情

1. 若使用了 generators/async，自动引入 @babel/runtime/regenerator
2. 使用 corejs 这个选项时，自动从 corejs 引入相关帮助 API。例如使用了 Promise，那么就从 corejs 中引入 Promise 这个类，从而起到了 polyfill 的作用。本意是为了提供给 JS 包使用，使它们可以更自由的使用浏览器的内建 API，避免假设用户已经做了 polyfill 的情况。这个选项需要配和相关的 @babel/runtime-corejs包使用
3. 移除 babel 编译过程中内联的帮助函数，改成从 @babel/runtime/helps 从引入。从而减少生成的包的体积

### 配置

```json
// 默认配置
{
	"plugins":[
    ["@babel/plugin-transform-runtime",
     {
       "absouluteRuntime":false,
       "corejs":false,//对应点 2
       "helpers":true, // 对应点 3
       "regenerator":true,//对应点 1
       "useESModules":false //是否开启 es6 模块，开启时 helpers 模块将以 es6 的形式导出，而不经过 @babel/plugin-transform-modules-commonjs
     }
    ]
  ]
}
```

#### corejs

`boolean|number`，默认 `false`

指定 polyfill 的 corejs 版本。并且需要安装对应的 runtime-corejs 版本。如指定 corejs:3，那么就需要安装 @babel/runtime-corejs3。

plugin-transform-runtime 的引入是不污染的全局的作用域，这是它 polyfill 的一个区别，并且它和 polyfill 理念是不一样的。polyfill 的想法是垫平环境的差异，因此需要根据环境差异来执行垫的操作，比如项目运行目标是运行在最新 chrome 上，那么它可能并不需要这个垫的操作。而 plugin-transform-runtime 是想提供一个可以自由使用内建 API 的环境给我们，使我们能毫无顾虑地使用这些内建 API，相当于一种全量引入。比如 Promise，那么就会自动从 core-js 中引入 Promise，相当于帮我们自动写了一条 require 语句。而且它并不会考虑目标环境，不管我们的目标环境是什么都会处理引入。在 corejs:2 选项中它能自动引入的帮助方法有限，可能无法识别引入 "foobar".includes("foo") 这类实例方法，在使用 orejs:3 中好像没有这个问题。

由于 plugin-transform-runtime 是按需提供一个 js 环境的，更适用于库和工具。而对于应用而言，它的目标环境明确，使用 useBuiltIns:"usage" 来处理更合适，能有效减少打包后的体积。

```js
var promise = new Promise();
// 转成
"use strict";
var _promise = require("@babel/runtime-corejs2/core-js/promise"); //！注意此处 Promise 直接从 runtime-corejs2 中引入，而不是直接依赖于全局对象。
var _promise2 = _interopRequireDefault(_promise);
var promise = new _promise2.default();
// 这意味着我们可以无缝使用这些内建的原生方法和静态方法
```

#### helpers

`boolean`，默认 `true`

```js
// 源码
class Person{}

//未开启 helpers
"use strict";
//！这是重复定义项
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

var Person = function Person() {
  _classCallCheck(this, Person);
};

// 开启 helpers
"use strict";

//！classCallCheck 从 runtime/helpers 引入，减少了打包大小
var _classCallCheck2 = require("@babel/runtime/helpers/classCallCheck");
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var Person = function Person() {
  (0, _classCallCheck3.default)(this, Person);
};
```

## @babel/cli

@babel/cli 自带了一个内置的 CLI 命令行工具，可以通过命令行来编译文件。此外各种能直接调用的脚本都存放在 @babel/cli/bin 中。主要有 babel-external-helpers.js 和 Babel cli 都主脚本 babel.js

### 用法

`babel main.js` 即编译 main.js 文件，**支持目录**

`babel main.js -o lib.js` -o 或者 --out-file 输出到某个文件

`babel main.js --watch -o lib.js` -w 或者 --watch 监听文件修改，重新编译

`bable main.js -o lib.js --source-maps` --source-maps 用来输出 source-map

`babel src --out-dir lib` -d 或者 --out-dir 输出到某个目录

## the super tiny compiler

[the super tiny compiler](https://github.com/jamiebuilds/the-super-tiny-compiler/blob/master/the-super-tiny-compiler.js) 是一个小型的编译器，通过简化一些流程从而让我们更高效理解 Babel 是怎么工作的。整篇代码移除注释只不过 200 多行，非常适合于学习。

大部分的编译程序工作流程分为以下三个步骤

1. **Parsing**。把源码解析更加抽象的产物，例如中间代码或抽象语法输
2. **Transformation**。对于抽象产物进行操作
3. **Code Generation**.即最终代码生成

### Parsing

解析的过程分为两个步骤，词法分析和语法分析。

词法分析的过程即对于源码进行切割，形成一个个 token。即 token 化。token 是一个对象数组，描述了一小段独立的语法片段，对象内描述可以是数字，标签，标点符号，操作符或者任意东西。

语法分析的过程将 token 重新组成一个描述各个语法部分之间关系的对象。例如中间代码或者抽象语法树。抽象语法树即 ast，是一个包含着丰富信息，容易操作的，深层嵌套的对象。

列如对于下列语法

```

(add 2 (subtract 4 2))

// token 化之后

[
     { type: 'paren',  value: '('        },
     { type: 'name',   value: 'add'      },
     { type: 'number', value: '2'        },
     { type: 'paren',  value: '('        },
     { type: 'name',   value: 'subtract' },
     { type: 'number', value: '4'        },
     { type: 'number', value: '2'        },
     { type: 'paren',  value: ')'        },
     { type: 'paren',  value: ')'        },
   ]

形成抽象语法树后

   {
     type: 'Program',
     body: [{
       type: 'CallExpression',
       name: 'add',
       params: [{
         type: 'NumberLiteral',
         value: '2',
       }, {
         type: 'CallExpression',
         name: 'subtract',
         params: [{
           type: 'NumberLiteral',
           value: '4',
         }, {
           type: 'NumberLiteral',
           value: '2',
         }]
       }]
     }]
   }
```

### 示例代码

**!TODO，加上自己的理解**

```js
function tokenizer(input) {

  // A `current` variable for tracking our position in the code like a cursor.
  let current = 0;

  // And a `tokens` array for pushing our tokens to.
  let tokens = [];

  // We start by creating a `while` loop where we are setting up our `current`
  // variable to be incremented as much as we want `inside` the loop.
  //
  // We do this because we may want to increment `current` many times within a
  // single loop because our tokens can be any length.
  while (current < input.length) {

    // We're also going to store the `current` character in the `input`.
    let char = input[current];

    // The first thing we want to check for is an open parenthesis. This will
    // later be used for `CallExpression` but for now we only care about the
    // character.
    //
    // We check to see if we have an open parenthesis:
    if (char === '(') {

      // If we do, we push a new token with the type `paren` and set the value
      // to an open parenthesis.
      tokens.push({
        type: 'paren',
        value: '(',
      });

      // Then we increment `current`
      current++;

      // And we `continue` onto the next cycle of the loop.
      continue;
    }

    // Next we're going to check for a closing parenthesis. We do the same exact
    // thing as before: Check for a closing parenthesis, add a new token,
    // increment `current`, and `continue`.
    if (char === ')') {
      tokens.push({
        type: 'paren',
        value: ')',
      });
      current++;
      continue;
    }

    // Moving on, we're now going to check for whitespace. This is interesting
    // because we care that whitespace exists to separate characters, but it
    // isn't actually important for us to store as a token. We would only throw
    // it out later.
    //
    // So here we're just going to test for existence and if it does exist we're
    // going to just `continue` on.
    let WHITESPACE = /\s/;
    if (WHITESPACE.test(char)) {
      current++;
      continue;
    }

    // The next type of token is a number. This is different than what we have
    // seen before because a number could be any number of characters and we
    // want to capture the entire sequence of characters as one token.
    //
    //   (add 123 456)
    //        ^^^ ^^^
    //        Only two separate tokens
    //
    // So we start this off when we encounter the first number in a sequence.
    let NUMBERS = /[0-9]/;
    if (NUMBERS.test(char)) {

      // We're going to create a `value` string that we are going to push
      // characters to.
      let value = '';

      // Then we're going to loop through each character in the sequence until
      // we encounter a character that is not a number, pushing each character
      // that is a number to our `value` and incrementing `current` as we go.
      while (NUMBERS.test(char)) {
        value += char;
        char = input[++current];
      }

      // After that we push our `number` token to the `tokens` array.
      tokens.push({ type: 'number', value });

      // And we continue on.
      continue;
    }

    // We'll also add support for strings in our language which will be any
    // text surrounded by double quotes (").
    //
    //   (concat "foo" "bar")
    //            ^^^   ^^^ string tokens
    //
    // We'll start by checking for the opening quote:
    if (char === '"') {
      // Keep a `value` variable for building up our string token.
      let value = '';

      // We'll skip the opening double quote in our token.
      char = input[++current];

      // Then we'll iterate through each character until we reach another
      // double quote.
      while (char !== '"') {
        value += char;
        char = input[++current];
      }

      // Skip the closing double quote.
      char = input[++current];

      // And add our `string` token to the `tokens` array.
      tokens.push({ type: 'string', value });

      continue;
    }

    // The last type of token will be a `name` token. This is a sequence of
    // letters instead of numbers, that are the names of functions in our lisp
    // syntax.
    //
    //   (add 2 4)
    //    ^^^
    //    Name token
    //
    let LETTERS = /[a-z]/i;
    if (LETTERS.test(char)) {
      let value = '';

      // Again we're just going to loop through all the letters pushing them to
      // a value.
      while (LETTERS.test(char)) {
        value += char;
        char = input[++current];
      }

      // And pushing that value as a token with the type `name` and continuing.
      tokens.push({ type: 'name', value });

      continue;
    }

    // Finally if we have not matched a character by now, we're going to throw
    // an error and completely exit.
    throw new TypeError('I dont know what this character is: ' + char);
  }

  // Then at the end of our `tokenizer` we simply return the tokens array.
  return tokens;
}

/**
 * ============================================================================
 *                                 ヽ/❀o ل͜ o\ﾉ
 *                                THE PARSER!!!
 * ============================================================================
 */

/**
 * For our parser we're going to take our array of tokens and turn it into an
 * AST.
 *
 *   [{ type: 'paren', value: '(' }, ...]   =>   { type: 'Program', body: [...] }
 */

// Okay, so we define a `parser` function that accepts our array of `tokens`.
function parser(tokens) {

  // Again we keep a `current` variable that we will use as a cursor.
  let current = 0;

  // But this time we're going to use recursion instead of a `while` loop. So we
  // define a `walk` function.
  function walk() {

    // Inside the walk function we start by grabbing the `current` token.
    let token = tokens[current];

    // We're going to split each type of token off into a different code path,
    // starting off with `number` tokens.
    //
    // We test to see if we have a `number` token.
    if (token.type === 'number') {

      // If we have one, we'll increment `current`.
      current++;

      // And we'll return a new AST node called `NumberLiteral` and setting its
      // value to the value of our token.
      return {
        type: 'NumberLiteral',
        value: token.value,
      };
    }

    // If we have a string we will do the same as number and create a
    // `StringLiteral` node.
    if (token.type === 'string') {
      current++;

      return {
        type: 'StringLiteral',
        value: token.value,
      };
    }

    // Next we're going to look for CallExpressions. We start this off when we
    // encounter an open parenthesis.
    if (
      token.type === 'paren' &&
      token.value === '('
    ) {

      // We'll increment `current` to skip the parenthesis since we don't care
      // about it in our AST.
      token = tokens[++current];

      // We create a base node with the type `CallExpression`, and we're going
      // to set the name as the current token's value since the next token after
      // the open parenthesis is the name of the function.
      let node = {
        type: 'CallExpression',
        name: token.value,
        params: [],
      };

      // We increment `current` *again* to skip the name token.
      token = tokens[++current];

      // And now we want to loop through each token that will be the `params` of
      // our `CallExpression` until we encounter a closing parenthesis.
      //
      // Now this is where recursion comes in. Instead of trying to parse a
      // potentially infinitely nested set of nodes we're going to rely on
      // recursion to resolve things.
      //
      // To explain this, let's take our Lisp code. You can see that the
      // parameters of the `add` are a number and a nested `CallExpression` that
      // includes its own numbers.
      //
      //   (add 2 (subtract 4 2))
      //
      // You'll also notice that in our tokens array we have multiple closing
      // parenthesis.
      //
      //   [
      //     { type: 'paren',  value: '('        },
      //     { type: 'name',   value: 'add'      },
      //     { type: 'number', value: '2'        },
      //     { type: 'paren',  value: '('        },
      //     { type: 'name',   value: 'subtract' },
      //     { type: 'number', value: '4'        },
      //     { type: 'number', value: '2'        },
      //     { type: 'paren',  value: ')'        }, <<< Closing parenthesis
      //     { type: 'paren',  value: ')'        }, <<< Closing parenthesis
      //   ]
      //
      // We're going to rely on the nested `walk` function to increment our
      // `current` variable past any nested `CallExpression`.

      // So we create a `while` loop that will continue until it encounters a
      // token with a `type` of `'paren'` and a `value` of a closing
      // parenthesis.
      while (
        (token.type !== 'paren') ||
        (token.type === 'paren' && token.value !== ')')
      ) {
        // we'll call the `walk` function which will return a `node` and we'll
        // push it into our `node.params`.
        node.params.push(walk());
        token = tokens[current];
      }

      // Finally we will increment `current` one last time to skip the closing
      // parenthesis.
      current++;

      // And return the node.
      return node;
    }

    // Again, if we haven't recognized the token type by now we're going to
    // throw an error.
    throw new TypeError(token.type);
  }

  // Now, we're going to create our AST which will have a root which is a
  // `Program` node.
  let ast = {
    type: 'Program',
    body: [],
  };

  // And we're going to kickstart our `walk` function, pushing nodes to our
  // `ast.body` array.
  //
  // The reason we are doing this inside a loop is because our program can have
  // `CallExpression` after one another instead of being nested.
  //
  //   (add 2 2)
  //   (subtract 4 2)
  //
  while (current < tokens.length) {
    ast.body.push(walk());
  }

  // At the end of our parser we'll return the AST.
  return ast;
}

/**
 * ============================================================================
 *                                 ⌒(❀>◞౪◟<❀)⌒
 *                               THE TRAVERSER!!!
 * ============================================================================
 */

/**
 * So now we have our AST, and we want to be able to visit different nodes with
 * a visitor. We need to be able to call the methods on the visitor whenever we
 * encounter a node with a matching type.
 *
 *   traverse(ast, {
 *     Program: {
 *       enter(node, parent) {
 *         // ...
 *       },
 *       exit(node, parent) {
 *         // ...
 *       },
 *     },
 *
 *     CallExpression: {
 *       enter(node, parent) {
 *         // ...
 *       },
 *       exit(node, parent) {
 *         // ...
 *       },
 *     },
 *
 *     NumberLiteral: {
 *       enter(node, parent) {
 *         // ...
 *       },
 *       exit(node, parent) {
 *         // ...
 *       },
 *     },
 *   });
 */

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
function traverser(ast, visitor) {

  // A `traverseArray` function that will allow us to iterate over an array and
  // call the next function that we will define: `traverseNode`.
  function traverseArray(array, parent) {
    array.forEach(child => {
      traverseNode(child, parent);
    });
  }

  // `traverseNode` will accept a `node` and its `parent` node. So that it can
  // pass both to our visitor methods.
  function traverseNode(node, parent) {

    // We start by testing for the existence of a method on the visitor with a
    // matching `type`.
    let methods = visitor[node.type];

    // If there is an `enter` method for this node type we'll call it with the
    // `node` and its `parent`.
    if (methods && methods.enter) {
      methods.enter(node, parent);
    }

    // Next we are going to split things up by the current node type.
    switch (node.type) {

      // We'll start with our top level `Program`. Since Program nodes have a
      // property named body that has an array of nodes, we will call
      // `traverseArray` to traverse down into them.
      //
      // (Remember that `traverseArray` will in turn call `traverseNode` so  we
      // are causing the tree to be traversed recursively)
      case 'Program':
        traverseArray(node.body, node);
        break;

      // Next we do the same with `CallExpression` and traverse their `params`.
      case 'CallExpression':
        traverseArray(node.params, node);
        break;

      // In the cases of `NumberLiteral` and `StringLiteral` we don't have any
      // child nodes to visit, so we'll just break.
      case 'NumberLiteral':
      case 'StringLiteral':
        break;

      // And again, if we haven't recognized the node type then we'll throw an
      // error.
      default:
        throw new TypeError(node.type);
    }

    // If there is an `exit` method for this node type we'll call it with the
    // `node` and its `parent`.
    if (methods && methods.exit) {
      methods.exit(node, parent);
    }
  }

  // Finally we kickstart the traverser by calling `traverseNode` with our ast
  // with no `parent` because the top level of the AST doesn't have a parent.
  traverseNode(ast, null);
}

/**
 * ============================================================================
 *                                   ⁽(◍˃̵͈̑ᴗ˂̵͈̑)⁽
 *                              THE TRANSFORMER!!!
 * ============================================================================
 */

/**
 * Next up, the transformer. Our transformer is going to take the AST that we
 * have built and pass it to our traverser function with a visitor and will
 * create a new ast.
 *
 * ----------------------------------------------------------------------------
 *   Original AST                     |   Transformed AST
 * ----------------------------------------------------------------------------
 *   {                                |   {
 *     type: 'Program',               |     type: 'Program',
 *     body: [{                       |     body: [{
 *       type: 'CallExpression',      |       type: 'ExpressionStatement',
 *       name: 'add',                 |       expression: {
 *       params: [{                   |         type: 'CallExpression',
 *         type: 'NumberLiteral',     |         callee: {
 *         value: '2'                 |           type: 'Identifier',
 *       }, {                         |           name: 'add'
 *         type: 'CallExpression',    |         },
 *         name: 'subtract',          |         arguments: [{
 *         params: [{                 |           type: 'NumberLiteral',
 *           type: 'NumberLiteral',   |           value: '2'
 *           value: '4'               |         }, {
 *         }, {                       |           type: 'CallExpression',
 *           type: 'NumberLiteral',   |           callee: {
 *           value: '2'               |             type: 'Identifier',
 *         }]                         |             name: 'subtract'
 *       }]                           |           },
 *     }]                             |           arguments: [{
 *   }                                |             type: 'NumberLiteral',
 *                                    |             value: '4'
 * ---------------------------------- |           }, {
 *                                    |             type: 'NumberLiteral',
 *                                    |             value: '2'
 *                                    |           }]
 *  (sorry the other one is longer.)  |         }
 *                                    |       }
 *                                    |     }]
 *                                    |   }
 * ----------------------------------------------------------------------------
 */

// So we have our transformer function which will accept the lisp ast.
function transformer(ast) {

  // We'll create a `newAst` which like our previous AST will have a program
  // node.
  let newAst = {
    type: 'Program',
    body: [],
  };

  // Next I'm going to cheat a little and create a bit of a hack. We're going to
  // use a property named `context` on our parent nodes that we're going to push
  // nodes to their parent's `context`. Normally you would have a better
  // abstraction than this, but for our purposes this keeps things simple.
  //
  // Just take note that the context is a reference *from* the old ast *to* the
  // new ast.
  ast._context = newAst.body;

  // We'll start by calling the traverser function with our ast and a visitor.
  traverser(ast, {

    // The first visitor method accepts any `NumberLiteral`
    NumberLiteral: {
      // We'll visit them on enter.
      enter(node, parent) {
        // We'll create a new node also named `NumberLiteral` that we will push to
        // the parent context.
        parent._context.push({
          type: 'NumberLiteral',
          value: node.value,
        });
      },
    },

    // Next we have `StringLiteral`
    StringLiteral: {
      enter(node, parent) {
        parent._context.push({
          type: 'StringLiteral',
          value: node.value,
        });
      },
    },

    // Next up, `CallExpression`.
    CallExpression: {
      enter(node, parent) {

        // We start creating a new node `CallExpression` with a nested
        // `Identifier`.
        let expression = {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: node.name,
          },
          arguments: [],
        };

        // Next we're going to define a new context on the original
        // `CallExpression` node that will reference the `expression`'s arguments
        // so that we can push arguments.
        node._context = expression.arguments;

        // Then we're going to check if the parent node is a `CallExpression`.
        // If it is not...
        if (parent.type !== 'CallExpression') {

          // We're going to wrap our `CallExpression` node with an
          // `ExpressionStatement`. We do this because the top level
          // `CallExpression` in JavaScript are actually statements.
          expression = {
            type: 'ExpressionStatement',
            expression: expression,
          };
        }

        // Last, we push our (possibly wrapped) `CallExpression` to the `parent`'s
        // `context`.
        parent._context.push(expression);
      },
    }
  });

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAst;
}

/**
 * ============================================================================
 *                               ヾ（〃＾∇＾）ﾉ♪
 *                            THE CODE GENERATOR!!!!
 * ============================================================================
 */

/**
 * Now let's move onto our last phase: The Code Generator.
 *
 * Our code generator is going to recursively call itself to print each node in
 * the tree into one giant string.
 */

function codeGenerator(node) {

  // We'll break things down by the `type` of the `node`.
  switch (node.type) {

    // If we have a `Program` node. We will map through each node in the `body`
    // and run them through the code generator and join them with a newline.
    case 'Program':
      return node.body.map(codeGenerator)
        .join('\n');

    // For `ExpressionStatement` we'll call the code generator on the nested
    // expression and we'll add a semicolon...
    case 'ExpressionStatement':
      return (
        codeGenerator(node.expression) +
        ';' // << (...because we like to code the *correct* way)
      );

    // For `CallExpression` we will print the `callee`, add an open
    // parenthesis, we'll map through each node in the `arguments` array and run
    // them through the code generator, joining them with a comma, and then
    // we'll add a closing parenthesis.
    case 'CallExpression':
      return (
        codeGenerator(node.callee) +
        '(' +
        node.arguments.map(codeGenerator)
          .join(', ') +
        ')'
      );

    // For `Identifier` we'll just return the `node`'s name.
    case 'Identifier':
      return node.name;

    // For `NumberLiteral` we'll just return the `node`'s value.
    case 'NumberLiteral':
      return node.value;

    // For `StringLiteral` we'll add quotations around the `node`'s value.
    case 'StringLiteral':
      return '"' + node.value + '"';

    // And if we haven't recognized the node, we'll throw an error.
    default:
      throw new TypeError(node.type);
  }
}

/**
 * ============================================================================
 *                                  (۶* ‘ヮ’)۶”
 *                         !!!!!!!!THE COMPILER!!!!!!!!
 * ============================================================================
 */

/**
 * FINALLY! We'll create our `compiler` function. Here we will link together
 * every part of the pipeline.
 *
 *   1. input  => tokenizer   => tokens
 *   2. tokens => parser      => ast
 *   3. ast    => transformer => newAst
 *   4. newAst => generator   => output
 */

function compiler(input) {
  let tokens = tokenizer(input);
  let ast    = parser(tokens);
  let newAst = transformer(ast);
  let output = codeGenerator(newAst);

  // and simply return the output!
  return output;
}

/**
 * ============================================================================
 *                                   (๑˃̵ᴗ˂̵)و
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!YOU MADE IT!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * ============================================================================
 */

// Now I'm just exporting everything...
module.exports = {
  tokenizer,
  parser,
  traverser,
  transformer,
  codeGenerator,
  compiler,
};
```
