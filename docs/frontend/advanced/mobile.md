# h5 开发

## H5 开发常见问题

### 滚动

#### 局部滚动出界

常见的场景就是在子元素中滚动中，滚到最顶部或最底部时由于 ios 的弹性滚动，界面超出，变成了全局滚动，

使用 touchstart 事件，判断是否滚动到了最顶端或者最底端，然后对 scrollTop 进行重新赋值，避免元素出界

```javascript
var ScrollFix = function(elem) {
    var startY, startTopScroll;
    elem.addEventListener('touchstart', function(event){
        startY = event.touches[0].pageY;
        startTopScroll = elem.scrollTop;
        //当滚动条在最顶部的时候
        if(startTopScroll <= 0)
            elem.scrollTop = 1;
        //当滚动条在最底部的时候
        if(startTopScroll + elem.offsetHeight >= elem.scrollHeight)
            elem.scrollTop = elem.scrollHeight - elem.offsetHeight - 1;
    }, false);
};
```

#### passive 优化滚动

addEventListener 的第三个参数支持传入对象，其中有一个参数就是 passive。这个参数用来告诉浏览器，事件监听函数是否会调用 e.preventDefault 来组织默认事件。以滚动事件为例，浏览器无法知道一个 scroll 事件的监听函数是否调用了 preventDefault，只能等到监听函数执行完后再去执行默认事件，如果监听函数执行很长时间，那么就会造成页面卡顿。对于滚动事件而言，就得等到滚动的监听函数执行完，浏览器才能去做页面滚动，这样有可能会造成页面的滚动卡顿，因此使用 passive 告诉浏览器不会阻止默认事件，那么就能快速执行滚动了。

#### 移动滚动优化

1. body上加上 -webkit-overflow-scrolling: touch
2. iOS尽量使用局部滚动
3. iOS引进scrollFix避免出界
4. android下尽量使用全局滚动：
   - 尽量不用 overflow：auto
   - 使用min-height：100% 替代 height：100%；
5. iOS下带有滚动条且position: absolute 的节点不要设置背景色
6. 固定区域使用 touchmove.preventDefault 来阻止引起全局的弹性滚动，但是会导致，如果从固定区域一直滑到滚动区域，即使在滚动区域进行滑动也会没有滚动效果