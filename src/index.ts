import { CommandClient, Message, GuildChannel } from 'eris'
import dd from 'datadog-metrics'
import emoji from 'node-emoji'

const statusUpdate = () => {
  if (!(bot as any).ready) {
    return
  }
  let status = {
    online: 0,
    idle: 0,
    dnd: 0,
    offline: 0
  }
  let users: string[] = []

  bot.guilds.forEach(guild => {
    let guildStatus = {
      online: 0,
      idle: 0,
      dnd: 0,
      offline: 0
    }
    guild.fetchAllMembers()
    guild.members.forEach(member => {
      if (!users.includes(member.id)) {
        users.push(member.id)
        status[member.status as 'online' | 'idle' | 'dnd' | 'offline']++
      }
      guildStatus[member.status as 'online' | 'idle' | 'dnd' | 'offline']++
    })
    dd.gauge(`members.online`, guildStatus.online, [ `guild:${guild.id}` ])
    dd.gauge(`members.idle`, guildStatus.idle, [ `guild:${guild.id}` ])
    dd.gauge(`members.dnd`, guildStatus.dnd, [ `guild:${guild.id}` ])
    dd.gauge(`members.offline`, guildStatus.offline, [ `guild:${guild.id}` ])
  })

  dd.gauge('users.online', status.online)
  dd.gauge('users.idle', status.idle)
  dd.gauge('users.dnd', status.dnd)
  dd.gauge('users.offline', status.offline)
}

const bot = new CommandClient(process.env.TOKEN)
dd.init({
  prefix: process.env.DATADOG_PREFIX,
  apiKey: process.env.DATADOG_KEY,
  flushIntervalSeconds: 0
})

setInterval(() => {
  dd.flush(() => {
    console.log('[INFO] Flushed to Datadog')
  }, err => {
    console.error(`[ERROR] Unable to flush to Datadog. ${err}`)
  })
}, 15000)

bot.on('messageCreate', msg => {
  console.log(`[INFO] Created ${msg.id}`)
  const tags = [
    `channel:${msg.channel.id}`,
    `user:${msg.author.id}`,
    `msg:${msg.id}`,
    `chan-type:${msg.channel.type}`
  ]
  if ((msg.channel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(msg.channel as GuildChannel).guild.id}`)
  }
  dd.increment(`message.creates`, 1, tags)
})

bot.on('messageUpdate', msg => {
  console.log(`[INFO] Edited ${msg.id}`)
  const tags = [
    `channel:${msg.channel.id}`,
    `user:${msg.author.id}`,
    `msg:${msg.id}`,
    `chan-type:${msg.channel.type}`
  ]
  if ((msg.channel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(msg.channel as GuildChannel).guild.id}`)
  }
  dd.increment(`message.edits`, 1, tags)
})

bot.on('messageDelete', msg => {
  console.log(`[INFO] Deleted ${msg.id}`)
  const tags = [
    `channel:${msg.channel.id}`,
    `msg:${msg.id}`,
    `chan-type:${msg.channel.type}`
  ]
  if ((msg as Message).author !== undefined) {
    tags.push(`user:${(msg as Message).author.id}`)
  }
  if ((msg.channel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(msg.channel as GuildChannel).guild.id}`)
  }
  dd.increment(`message.deletes`, 1, tags)
})

bot.on('guildMemberAdd', (guild, user) => {
  console.log(`[INFO] Guild member joined ${guild.id}`)
  dd.increment(`member.joins`, 1, [
    `guild:${guild.id}`,
    `user:${user.id}`
  ])
})

bot.on('guildMemberRemove', (guild, user) => {
  console.log(`[INFO] Guild member removed from ${guild.id}`)
  dd.increment(`member.removes`, 1, [
    `guild:${guild.id}`,
    `user:${user.id}`
  ])
})

bot.on('presenceUpdate', () => {
  console.log(`[INFO] Collecting user status.`)
  statusUpdate()
})

bot.on('messageReactionAdd', (msg, e, u) => {
  console.log(`[INFO] Reaction added on ${msg.id}`)
  const tags = [
    `channel:${msg.channel.id}`,
    `user:${u}`,
    `msg:${msg.id}`,
    `chan-type:${msg.channel.type}`
  ]
  if (e.id === null) {
    tags.push(`emoji:${emoji.find(e.name).key}`)
  } else {
    tags.push(`emoji:${e.name}`)
    tags.push(`custom-emoji:${e.id}`)
  }
  if ((msg.channel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(msg.channel as GuildChannel).guild.id}`)
  }
  dd.increment(`reactions.add`, 1, tags)
})

bot.on('messageReactionRemove', (msg, e, u) => {
  console.log(`[INFO] Reaction removed on ${msg.id}`)
  const tags = [
    `channel:${msg.channel.id}`,
    `user:${u}`,
    `msg:${msg.id}`,
    `chan-type:${msg.channel.type}`
  ]
  if (e.id === null) {
    tags.push(`emoji:${emoji.find(e.name).key}`)
  } else {
    tags.push(`emoji:${e.name}`)
    tags.push(`custom-emoji:${e.id}`)
  }
  if ((msg.channel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(msg.channel as GuildChannel).guild.id}`)
  }
  dd.increment(`reactions.remove`, 1, tags)
})

bot.on('ready', () => {
  console.log(`[INFO] Connected to discord as ${bot.user.username}#${bot.user.discriminator}`)
})

process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM recieved, disconnecting..')
  bot.disconnect({
    reconnect: false
  })
  dd.flush()
})

setInterval(() => {
  console.log('[INFO] Collecting user status')
  statusUpdate()
}, 60000)

bot.connect()
  .catch(console.error)