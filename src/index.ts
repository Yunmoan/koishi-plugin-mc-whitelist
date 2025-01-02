import {Context, Schema } from 'koishi'
import Rcon, {RconError} from 'rcon-ts';

export const inject = {
  required: ['database'],
}

export const name = 'mc-whitelist'
export const usage = '# @yunmoan/koishi-plugin-mc-whitelist\n' +
  '\n' +
  '[![npm](https://img.shields.io/npm/v/@yunmoan/koishi-plugin-mc-whitelist?style=flat-square)](https://www.npmjs.com/package/@yunmoan/koishi-plugin-mc-whitelist)\n' +
  '\n' +
  'Miectrat 服务器自助白名单添加绑定\n' +
  '仅针对 QQ 优先兼容优化，其他平台尚不明确。\n\n' +
  '此插件仅针对基于 LLonebot  的 QQ 平台开发使用，其他平台尚不明确'+
  '\n' +
  '本插件基于 Rcon 功能实现，需要在服务端上安装 EasyWhitelist 插件。\n' +
  '\n' +
  '使用此方案是由于我测试用的服务端版本核心不支持白名单热添加，如果你的服务端支持白名单热添加，请关闭对 EasyWhitelist 的支持。\n' +
  '\n' +
  '[EasyWhitelist插件下载](https://www.spigotmc.org/resources/easywhitelist-name-based-whitelist.65222/) (SpigotMC)\n' +
  '\n' +
  '游戏 ID 与绑定的QQ号将保存在 Koishi 数据库系统\n\n' +
  'Made by 云默安\n' +
  '© 2025 ZGIT Network. All rights reserved.\n'

export interface Config {
  isEasyWhitelist: boolean
  checkAllowedGroup: boolean
  useMysqlDatabase: boolean
  ServerAddress: string
  ServerRconPort: number
  rconPassword: string
  rconConnectingTimeout: number
  id: string[]
}

export const Config: Schema = Schema.intersect([
  Schema.object({
    isEasyWhitelist: Schema.boolean().default(true).description('是否使用 EasyWhitelist 插件'),
    checkAllowedGroup: Schema.boolean().default(false).description('是否要求只能在指定群聊中绑定ID'),
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
  username: string
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

  ctx.model.extend('bind_list', {
    id: 'unsigned',
    GameID: 'string',
    userId: 'string',
    username: 'string',

  }, {primary: 'id', autoInc: true});

  const rcon = new Rcon({
    host: config.ServerAddress,
    port: config.ServerRconPort,
    password: config.rconPassword
  })

  ctx.command('testwhitelist')
    .action(async ({ session }) => {
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

  ctx.command('绑定ID <player>')
    .action(async ({ session }, player) => {
      let result = ''
      const {userId, username} = session

      // }
      logger.info(`Try to Add ${player} by ${userId} (${username})` )

      if (player === undefined) {
        return '无效输入!\n命令使用方法：绑定ID Yun_mo_an(这里是你的游戏ID)'
      }
      try {
        await rcon.connect()
        if (config.isEasyWhitelist) {

          await rcon.send(`easywl add ${player}`)
          result = `玩家 ${player} 绑定成功！账户已与 \n${userId} (${username}) 绑定成功`

        } else {
          result += await rcon.send(`whitelist add ${player}`)

        }
        await ctx.database.create('bind_list', {
          GameID: player,
          userId: userId,
          username: username,
        })
        rcon.disconnect()
      } catch (e) {
        logger.error(e);
        result += `连接失败: ${e}\n`
      }
      return result
    })

  ctx.command('在线玩家')
    .action(async (_) => {
      let result = ''

      result += `服务器在线玩家数据:`
      try {
        await rcon.connect()
        let online_message = await rcon.send(`list`)
        let onlinePlayerCount = online_message.split('There are')[1].split('of a')[0].trim()
        let maxPlayerCount = online_message.split('max of')[1].split('players online')[0].trim()
        if (onlinePlayerCount === "0") {
          result += " 当前无人在线"
        } else {
          let players = online_message.split(':')[1]
          result += players
          result += " (" + onlinePlayerCount + "/" + maxPlayerCount + ")"
        }
        result += '\n'
        rcon.disconnect()
      } catch (e) {
        logger.error(e)
        result += `连接失败 ${e}\n`
      }
      return result
    })

}
