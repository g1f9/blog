# charles 抓包教程

## PC 端抓包

1. 配置 charles 代理端口
2. chrome 上安装 Proxy SwitchySharp 插件
3. 配置 Proxy SwitchySharp 的代理端口和 ip 为 charles 设置 ip 和端口
4. 打开即可启用

## 移动端抓包

1. 配置 charles 的代理端口
2. 在同一个局域网内配置手机 wifi 代理为 PC 机子的 ip 代理，charles 的端口地址
3. 确保 http 抓包成功
4. 在移动端安装 ssl 证书。确保手机 wifi 在 charles 的代理下，用手机浏览器打开 chls.pro/ssl，安卓会自动安装，并且不用配置信任。ios 根据提示一步步安装，并在 设置>通用>关于>证书信任 下启用 charles 证书
