import {Context, Schema} from 'koishi'
import type {} from '@koishijs/plugin-help'
import Rcon, {RconError} from 'rcon-ts';

export const inject = {
  required: ['database'],
}

export const name = 'mc-whitelist'
export const usage = '# @yunmoan/koishi-plugin-mc-whitelist\n' +
  '\n' +
  '[![npm](https://img.shields.io/npm/v/@yunmoan/koishi-plugin-mc-whitelist?style=flat-square)](https://www.npmjs.com/package/@yunmoan/koishi-plugin-mc-whitelist)\n' +
  '\n' +
  'Minecraft 服务器自助白名单添加绑定\n' +
  '仅针对 QQ 优先兼容优化，其他平台尚不明确。\n\n' +
  '~~此插件仅针对基于 LLonebot  的 QQ 平台开发使用，其他平台尚不明确~~\n\n' +
  '从理论上来说，所有平台都兼容，但是我们仍然优先针对QQ开发\n' +
  '\n' +
  '本插件基于 Rcon 功能实现，需要在服务端上安装 EasyWhitelist 插件。\n' +
  '\n' +
  '特色:\n' +
  '- 支持白名单热添加\n' +
  '- 保存到 Koishi 内置数据库\n' +
  '- 可限制绑定最大数量\n' +
  '- 支持自助绑定/解绑（可由管理员辅助）\n' +
  '- 管理员可通过此插件远程执行命令(目前只支持向单个服务器发送命令)\n\n' +

  '**注意，不兼容也不计划兼容中文用户名或特殊字符的绑定**\n\n' +
  '*使用此方案是由于我测试用的服务端版本核心不支持白名单热添加，如果你的服务端支持白名单热添加，请关闭对 EasyWhitelist 的支持。*\n\n' +
  '\n' +
  '[EasyWhitelist插件下载](https://www.spigotmc.org/resources/easywhitelist-name-based-whitelist.65222/) (SpigotMC)\n' +
  '\n' +
  '游戏 ID 与绑定的QQ号将保存在 Koishi 数据库系统\n\n' +
  'Made by 云默安 | [我们的爱发电](https://afdian.com/a/zgitnetwork)\n\n' +
  '© 2025 ZGIT Network. All rights reserved.\n'

export interface Config {
  isEasyWhitelist: boolean
  checkAllowedGroup: boolean
  useMysqlDatabase: boolean
  ServerAddress: string
  ServerRconPort: number
  rconPassword: string
  rconConnectingTimeout: number
  AllowUserBindMaxNumber: number
  adminList: string[]
  id: string[]
}

export const Config: Schema = Schema.intersect([
  Schema.object({
    isEasyWhitelist: Schema.boolean().default(true).description('是否使用 EasyWhitelist 插件'),
    checkAllowedGroup: Schema.boolean().default(false).description('是否要求只能在指定群聊中绑定ID'),
    AllowUserBindMaxNumber: Schema.number().default(3).description('限制单个账户绑定玩家ID的个数'),
    adminList: Schema.array(Schema.string()).description('管理员用户ID列表 *注意,此列表有远程执行指令的权力！*').default([]),
  }).description('全局配置'),
  Schema.union([
    Schema.object({
      checkAllowedGroup: Schema.const(true).required(),
      allowedGroups: Schema.array(Schema.string()).description('允许使用指令的群聊'),
      refusedText: Schema.string().description('拒绝使用指令时的回复').default('当前群聊不在允许的群聊列表中，别干坏事哦~'),
    }),
    Schema.object({}),
  ]),

  Schema.object({
    ServerAddress: Schema.string().description('服务器地址').default('localhost'),
    ServerRconPort: Schema.number().description('RCON 端口').default(25575).min(1).max(65535),
    rconPassword: Schema.string().description('RCON 密码').default('MyPasswd'),
  }).description('服务器配置'),

  Schema.object({
    useMysqlDatabase: Schema.boolean().default(false).description('是否使用 MySQL 数据库'),
  }).description('MySQL 配置(尚不支持)'),
])

declare module 'koishi' {
  interface Tables {
    bind_list: bind_list
  }
}


export interface bind_list {
  id: number;
  GameID: string;
  userId: string;
  username: string;
  bindDate: Date;
}



export function apply(ctx: Context, config: Config) {
  // write your plugin here
  const logger = ctx.logger('mc-whitelist')
  // 检查密码是否为空
  if (config.rconPassword === '') {
    logger.error('\n！插件已自动关闭！密码为空，Minecraft RCON在密码为空的情况下会自动关闭，请在Minecraft服务端的server.properties文件中设置rcon-password后重新调整插件配置')
    throw new Error('密码为空，请在插件配置页面填写密码')
  }
  logger.info(config)

  function isAdmin(userId, adminList) {
    return adminList.includes(userId); // 检查用户是否在管理员列表中
  }

  // 去掉文本中的颜色代码
  function removeColorCodes(text) {
    // 通过正则表达式替换掉颜色代码
    return text.replace(/§[0-9A-FK-ORx]/gi, '');
  }


  ctx.model.extend('bind_list', {
    id: 'unsigned',
    GameID: 'string',
    userId: 'string',
    username: 'string',
    bindDate: 'timestamp',

  }, {primary: 'id', autoInc: true});

  const rcon = new Rcon({
    host: config.ServerAddress,
    port: config.ServerRconPort,
    password: config.rconPassword
  })

  ctx.command('testwhitelist', {hidden: true})
    .action(async ({session}) => {
      const {userId, username} = session

      let result = ''
      // logger.info(username)
      try {
        await rcon.connect()
        result += await rcon.send(`say testing QQ Whitelist Koishi Plugin 正在测试QQ白名单绑定`)
        rcon.disconnect()
        return `@yunmoan/koishi-plugin-mc-whitelist 插件测试成功！与服务器的Rcon连接正确可用！\n获取到用户信息 ${userId}`

      } catch (e) {
        logger.error(e);
        result += `连接失败: ${e}\n`
      }
      return result
    })

  ctx.on('message', (session) => {
    if (session.content === '白名单绑定') {

      session.send('请使用 /绑定ID ID \n命令使用方法：/绑定ID Yun_mo_an')
    }
  })

  ctx.command('绑定ID <player>', '绑定游戏ID')
    .alias('bd').alias('绑定')
    .action(async ({session}, player) => {
      let result = '';
      const {userId, username} = session;

      logger.info(`Try to Add ${player} by ${userId} (${username})`);

      // 验证 player 是否符合 Minecraft 正版 ID 的格式
      const validPlayerRegex = /^[a-zA-Z0-9_]+$/;
      if (!player || player.length > 16 || !validPlayerRegex.test(player)) {
        return "无效输入!\n命令使用方法：绑定ID 你的ID \n游戏ID只能包含字母、数字和下划线(_)且不能超过16位，请重新输入。\n例如：绑定ID Yun_mo_an";
      }

      // 检查该游戏 ID 是否已经被绑定
      const existingPlayerBinding = await ctx.database.get('bind_list', {GameID: player});
      if (existingPlayerBinding.length > 0) {
        const existingUser = existingPlayerBinding[0].userId;
        if (existingUser === userId) {
          return `绑定失败：您已经绑定了此游戏ID (${player})，无需重复绑定。`;
        } else {
          return `绑定失败：此游戏ID (${player}) 已被其他人绑定，无法再次绑定。`;
        }
      }

      // 检查数据库中当前 userId 已绑定的 ID 数量
      const existingBindings = await ctx.database.get('bind_list', {userId});
      if (existingBindings.length >= config.AllowUserBindMaxNumber) {
        return `绑定失败：您已绑定了 ${existingBindings.length} 个游戏ID，已达到最大限制（${config.AllowUserBindMaxNumber}个）。输入 查询绑定 可查看您目前绑定的ID个数`;
      }

      try {
        await rcon.connect();
      if (config.isEasyWhitelist) {
        await rcon.send(`easywl add ${player}`);
        result = `玩家 ${player} 绑定成功！账户已与 \n${userId} (${username}) 绑定成功`;
      } else {
        result += await rcon.send(`whitelist add ${player}`);
      }

      await ctx.database.create('bind_list', {
        GameID: player,
        userId: userId,
        username: username,
        bindDate: new Date(),
      });
      rcon.disconnect();
      } catch (e) {
        logger.error(e);
      return `连接失败: ${e}\n无法与服务端通讯，请联系管理员！！`;
      }

      return result;
    });

  ctx.command('手动绑定 <player> [user_id]', '绑定游戏ID')
    .alias('abd').alias('管理绑定')
    .action(async ({session}, player, user_id) => {
      let result = '';
      const {userId, username} = session;

      logger.info(`Administrator tries to manually add a binding ${player} -> ${user_id}`);

      if (!user_id) {
        return '请提供要绑定的用户ID。';
      }

      // 检查是否为管理员
      if (!isAdmin(userId, config.adminList)) {
        return '您没有权限执行此命令，请联系管理员。';
      }

      // 验证 player 是否符合 Minecraft 正版 ID 的格式
      const validPlayerRegex = /^[a-zA-Z0-9_]+$/;
      if (!player || player.length > 16 || !validPlayerRegex.test(player)) {
        return "无效输入!\n命令使用方法：手动绑定 游戏ID 用户标识(用户ID) \n游戏ID只能包含字母、数字和下划线(_)且不能超过16位，请重新输入。\n例如：绑定ID Yun_mo_an 114514191";
      }

      // 检查该游戏 ID 是否已经被绑定
      const existingPlayerBinding = await ctx.database.get('bind_list', {GameID: player});
      if (existingPlayerBinding.length > 0) {
        const existingUser = existingPlayerBinding[0].userId;
        if (existingUser === user_id) {
          return `绑定失败：${user_id} 已经绑定了此游戏ID (${player})，无法重复绑定！`;
        } else {
          return `绑定失败：此游戏ID (${player}) 已被其他人绑定，无法再次绑定。`;
        }
      }

      // 检查数据库中当前 userId 已绑定的 ID 数量
      const existingBindings = await ctx.database.get('bind_list', {userId});
      if (existingBindings.length >= config.AllowUserBindMaxNumber) {
        return `绑定失败：用户 ${user_id} 已绑定了 ${existingBindings.length} 个游戏ID，已达到最大限制（${config.AllowUserBindMaxNumber}个）。输入 '查询玩家绑定 用户ID' 可查看您目前绑定的ID个数`;
      }

      try {
        await rcon.connect();
        if (config.isEasyWhitelist) {
          await rcon.send(`easywl add ${player}`);
          result = `玩家 ${player} 绑定成功！该账户已与 \n${user_id} 绑定成功`;
        } else {
          result += await rcon.send(`whitelist add ${player}`);
        }

        await ctx.database.create('bind_list', {
          GameID: player,
          userId: user_id,
          username: '管理员手动绑定',
          bindDate: new Date(),
        });
        rcon.disconnect();
      } catch (e) {
        logger.error(e);
        return `连接失败: ${e}\n无法与服务端通讯，请联系系统管理员！！`;
      }

      return result;
    });


  ctx.command('查询绑定', '查询当前账户绑定的ID')
    .alias('cxbd').alias('bindlist')
    .action(async ({session}) => {
      const {userId, username} = session

      logger.info(`User ${userId} (${username}) trying to query bind list`)

      let UserBindList = await ctx.database.get('bind_list', {
        userId: userId,
      })

      let bindInfo;

      if(UserBindList.length !== 0) {
        const bindInfo = UserBindList.map(item => {
          const bindDate = item.bindDate ? new Date(item.bindDate).toLocaleString() : '未知'; // 如果没有绑定日期，显示 "未知"
          return `- [#${item.id}] ${item.GameID} （绑定日期：${bindDate}）`;
        }).join('\n');

        return `您已绑定了如下ID：\n${bindInfo}`;
      } else {
        return '您尚未绑定任何ID。';
      }
    })

  ctx.command('解绑ID <player>', '解除绑定的ID并移除白名单')
    .alias('jbid').alias('解绑').alias('解除绑定').alias('jcbd')
    .action(async ({ session }, player) => {
      const { userId, username } = session;

      // 验证 player 是否符合 Minecraft 正版 ID 的格式
      const validPlayerRegex = /^[a-zA-Z0-9_]+$/;
      if (!player || player.length < 16 || !validPlayerRegex.test(player)) {
        return "无效输入!\n命令使用方法：解绑ID 你的ID \n游戏ID只能包含字母、数字和下划线(_)且不能超过16位，请重新输入。\n例如：解绑ID Yun_mo_an";
      }

      // 获取当前用户绑定的列表
      let UserBindList = await ctx.database.get('bind_list', { userId: userId });

      // 检查输入的 ID 是否属于用户
      const targetBind = UserBindList.find(item => item.GameID === player);

      if (!targetBind) {
        // 如果输入的 ID 不在用户的绑定列表中
        if (UserBindList.length === 0) {
          return "解绑失败：您尚未绑定任何ID。";
        }

        const bindInfo = UserBindList.map(item => {
          const bindDate = item.bindDate ? new Date(item.bindDate).toLocaleString() : '未知'; // 如果没有绑定日期，显示 "未知"
          return `- [#${item.id}] ${item.GameID} （绑定日期：${bindDate}）`;
        }).join('\n');

        return `解绑失败：此ID (${player}) 不属于您所有。\n您已绑定的ID如下：\n${bindInfo}`;
      }

      // 从数据库中移除绑定记录（但不删除，直到白名单移除成功）
      let dbRemoveSuccess = false;

      try {
        // 连接到 RCON 服务端
        await rcon.connect();

        // 移除白名单
        let rconResponse;
        if (config.isEasyWhitelist) {
          rconResponse = await rcon.send(`easywl remove ${player}`);
        } else {
          rconResponse = await rcon.send(`whitelist remove ${player}`);
        }

        // 检查 RCON 响应，确保白名单移除成功
        if (!rconResponse || rconResponse.includes('Failed')) {
          rcon.disconnect();
          return `移除白名单失败：服务器返回错误信息: ${rconResponse}`;
        }

        // 白名单移除成功后删除数据库记录
        await ctx.database.remove('bind_list', { GameID: player });

        // 断开与 RCON 的连接
        rcon.disconnect();


          return `解绑成功：玩家 ${player} 已解绑并移除白名单。`;
      } catch (e) {
        // 处理与 RCON 服务端通讯失败的情况
        logger.error('RCON 连接或命令执行失败:', e);
        rcon.disconnect(); // 确保断开连接
        return `连接失败: ${e.message}\n无法与服务端通讯，请联系管理员。`;
      }
    });

  ctx.command('查询玩家绑定 <user_id>', '查询指定用户(比如QQ号)绑定的ID',{hidden:true})
    .alias('acxbd')
    .action(async ({ session }, user_id) => {
      const { userId, username } = session;

      if (!user_id) {
        return '请提供要查询的用户ID。';
      }

      // 检查是否为管理员
      if (!isAdmin(userId, config.adminList)) {
        return '您没有权限执行此命令，请联系管理员。';
      }

      logger.info(`Administrator query ${user_id} 's bind list`)

      let UserBindList = await ctx.database.get('bind_list', { userId: user_id });

      let bindInfo;

      if(UserBindList.length !== 0) {
        const bindInfo = UserBindList.map(item => {
          const bindDate = item.bindDate ? new Date(item.bindDate).toLocaleString() : '未知'; // 如果没有绑定日期，显示 "未知"
          return `- [#${item.id}] ${item.GameID} （绑定日期：${bindDate}）`;
        }).join('\n');

        return `该用户已绑定了如下ID：\n${bindInfo}`;
      } else {
        return '该用户尚未绑定任何ID。';
      }


    })


// 删除绑定命令
  ctx.command('删除绑定 <player>', '删除用户绑定的ID(需要用户提供白名单ID)', { hidden: true })
    .alias('ascbd')
    .action(async ({ session }, player) => {
      const { userId, username } = session;

      // 检查是否为管理员
      if (!isAdmin(userId, config.adminList)) {
        return '您没有权限执行此命令，请联系管理员。';
      }

      // 验证输入格式
      const validPlayerRegex = /^[a-zA-Z0-9_]+$/; // 游戏ID格式
      const isDatabaseID = /^#\d+$/; // 数据库ID格式
      if (!player || player.length < 16  || (!validPlayerRegex.test(player) && !isDatabaseID.test(player))) {
        return "无效输入!\n命令使用方法：\n- 删除绑定 玩家ID\n- 删除绑定 #数字ID\n游戏ID只能包含字母、数字和下划线(_)且不能超过16位，数字ID需以 # 开头。\n例如：删除绑定 Yun_mo_an 或 删除绑定 #123";
      }

      // 查询绑定记录
      let targetBind;
      if (isDatabaseID.test(player)) {
        // 如果输入为 #ID，则提取数据库ID并查询
        const databaseID = Number(player.replace('#', ''));
        targetBind = await ctx.database.get('bind_list', { id: databaseID });
      } else {
        // 如果输入为玩家ID，则按 GameID 查询
        targetBind = await ctx.database.get('bind_list', { GameID: player });
      }

      // 检查是否找到绑定记录
      if (!targetBind || targetBind.length === 0) {
        return `未找到绑定记录：输入的ID (${player}) 不存在或未绑定。`;
      }

      // 获取绑定信息
      const bind = targetBind[0];

      // 删除绑定记录

        // 移除白名单（如果需要）
        try {
          await rcon.connect();
          if (config.isEasyWhitelist) {
            await rcon.send(`easywl remove ${bind.GameID}`);
            await ctx.database.remove('bind_list', { id: bind.id });
            return `删除成功：玩家 ${bind.GameID} 与 ${bind.username}(${bind.userId}) 的绑定记录已删除，并从白名单中移除。`;
          } else {
            await rcon.send(`whitelist remove ${bind.GameID}`);
            await ctx.database.remove('bind_list', { id: bind.id });
            return `删除成功：玩家 ${bind.GameID} 与 ${bind.username}(${bind.userId}) 的绑定记录已删除，并从白名单中移除。`;
          }
          rcon.disconnect();
        } catch (error) {
          logger.error('移除白名单失败:', error);
          return `移除白名单失败：${error.message}`;
        }


    });



  ctx.command('删除绑定 <player>', '删除用户绑定的ID(需要用户提供白名单ID)', { hidden: true })
    .alias('ascbd')
    .action(async ({ session }, player) => {
      const { userId, username } = session;

      // 检查是否为管理员
      if (!isAdmin(userId, config.adminList)) {
        return '您没有权限执行此命令，请联系管理员。';
      }

      // 验证输入格式
      const validPlayerRegex = /^[a-zA-Z0-9_]+$/; // 游戏ID格式
      const isDatabaseID = /^#\d+$/; // 数据库ID格式
      if (!player || player.length < 16 || (!validPlayerRegex.test(player) && !isDatabaseID.test(player))) {
        return "无效输入!\n命令使用方法：\n- 删除绑定 玩家ID\n- 删除绑定 #数字ID\n游戏ID只能包含字母、数字和下划线(_)且不能超过16位，数字ID需以 # 开头。\n例如：删除绑定 Yun_mo_an 或 删除绑定 #123";
      }

      // 查询绑定记录
      let targetBind;
      if (isDatabaseID.test(player)) {
        // 如果输入为 #ID，则提取数据库ID并查询
        const databaseID = Number(player.replace('#', ''));
        targetBind = await ctx.database.get('bind_list', { id: databaseID });
      } else {
        // 如果输入为玩家ID，则按 GameID 查询
        targetBind = await ctx.database.get('bind_list', { GameID: player });
      }




    });

//命令执行
  ctx.command('执行命令 <commands:text>', '向服务器执行命令（也可以用 cmd）', { hidden: true })
    .alias('cmd')
    .action(async ({ session  }, commands) => {
      const {userId, username} = session;

      // 检查是否为管理员
      if (!isAdmin(userId, config.adminList)) {
        return '您没有权限执行此命令，请联系管理员。';
      }

      if(!commands){
        return '执行失败：禁止发送空命令'
      }

      try {
        await rcon.connect();
        const server_result = await rcon.send(`${commands}`);

        // 处理去除颜色代码
        const cleanedResult = removeColorCodes(server_result);

        logger.info(`Admin ${username}(${userId}) send command to server:  ${commands}\n ${cleanedResult}`)

        rcon.disconnect();
        return `命令执行成功：\n${cleanedResult}`;

      } catch (error) {
        logger.error('命令执行失败:', error);
        return `命令执行失败，无法与服务器通信：${error.message}`;
      }
    })


  //这部分代码有问题，暂时不准备继续兼容

  // ctx.command('在线玩家')
  //   .action(async (_) => {
  //     let result = ''
  //
  //     result += `服务器在线玩家数据:`
  //     try {
  //       await rcon.connect()
  //       let online_message = await rcon.send(`list`)
  //       let onlinePlayerCount = online_message.split('There are')[1].split('of a')[0].trim()
  //       let maxPlayerCount = online_message.split('max of')[1].split('players online')[0].trim()
  //       if (onlinePlayerCount === "0") {
  //         result += " 当前无人在线"
  //       } else {
  //         let players = online_message.split(':')[1]
  //         result += players
  //         result += " (" + onlinePlayerCount + "/" + maxPlayerCount + ")"
  //       }
  //       result += '\n'
  //       rcon.disconnect()
  //     } catch (e) {
  //       logger.error(e)
  //       result += `连接失败 ${e}\n`
  //     }
  //     return result
  //   })

}
