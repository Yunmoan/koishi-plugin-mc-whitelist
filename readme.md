# @yunmoan/koishi-plugin-mc-whitelist

[![npm](https://img.shields.io/npm/v/@yunmoan/koishi-plugin-mc-whitelist?style=flat-square)](https://www.npmjs.com/package/@yunmoan/koishi-plugin-mc-whitelist)

支持Miectrat白名单添加绑定

仅针对 QQ 优先兼容优化，其他平台尚不明确。

~~此插件仅针对基于 LLonebot  的 QQ 平台开发使用，其他平台尚不明确~~

从理论上来说，所有平台都兼容，但是我们仍然优先针对QQ开发



本插件基于 Rcon 功能实现，需要在服务端上安装 EasyWhitelist 插件。

使用此方案是由于我测试用的服务端版本核心不支持白名单热添加，如果你的服务端支持白名单热添加，请关闭对 EasyWhitelist 的支持。

features:
- 支持白名单热添加
- 保存到 Koishi 内置数据库
- 可限制QQ绑定数量
- 支持自助绑定/解绑(管理员可辅助)
- 管理员可通过此插件远程执行命令

**注意，不兼容也不计划兼容中文用户名或特殊字符的绑定**


[TODO] 计划兼容 MySQL 数据库

[EasyWhitelist插件下载](https://www.spigotmc.org/resources/easywhitelist-name-based-whitelist.65222/) （SpigotMC）

可选将列表数据保存到 MySQL 数据库，或者本地保存。
***
Made by 云默安 | [我们的爱发电](https://afdian.com/a/zgitnetwork)

© 2025 ZGIT Network. All rights reserved.
