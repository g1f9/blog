# Web 协议性能与发展

> 这是一篇从协议的角度上，来如何优化 web 站点的性能。本篇内容大部分都来自 Web 性能权威指南，摘抄总结感兴趣的内容，便于记忆和回顾。建议直接看书，对于整个 http 协议的前因后果，以及未来都有个大致的了解。

## HTTP

### HTTP 历史

HTTP 超文本传输协议，是互联网上最普遍采用的一种应用协议，是现代Web基础。了解 HTTP 发展的历史，理解 HTTP 在设计上的关键转变，以及每次转变背后的动机，对于讨论 HTTP 性能优化，特别是 HTTP2.0 至关重要。

#### HTTP 0.9

HTTP 0.9 是只有一行的协议，目的是为了推动万维网应用这个萌芽的思想，Tim Berners-Lee 最初的 HTTP 建议是以简洁为出发点设计的，并罗列了几条宏观的设计目标：

1. 支持文件传输