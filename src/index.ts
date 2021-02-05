import { Client, Message, GuildChannel, VoiceChannel } from 'eris'
import dd from 'datadog-metrics'
import emoji from 'node-emoji'

const statusUpdate = () => {
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

const voiceUpdate = () => {
  bot.guilds.forEach(guild => {
    guild.channels.forEach(channel => {
      if (channel.type === 2) {
        dd.gauge('voice.members', (channel as VoiceChannel).voiceMembers.size, [
          `guild:${guild.id}`,
          `channel:${channel.id}`
        ])
      }
    })
  })
}

const bot = new Client(process.env.TOKEN, {
  intents: [
    'guilds',
    'guildMembers',
    'guildVoiceStates',
    'guildPresences',
    'guildMessages',
    'guildMessageReactions'
  ]
})
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
    // @ts-expect-error
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

bot.on('messageReactionAdd', (msg, e, u) => {
  console.log(`[INFO] Reaction added on ${msg.id}`)
  const tags = [
    `channel:${msg.channel.id}`,
    `user:${u}`,
    `msg:${msg.id}`,
    // @ts-expect-error
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
    // @ts-expect-error
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

bot.on('voiceChannelJoin', (member, channel) => {
  console.log(`[INFO] Member joined ${channel.id}`)
  voiceUpdate()
  const tags = [
    `channel:${channel.id}`,
    `user:${member.id}`
  ]
  if ((channel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(channel as GuildChannel).guild.id}`)
  }
  dd.increment(`voice.joins`, 1, tags)
})

bot.on('voiceChannelSwitch', (member, newChannel, oldChannel) => {
  console.log(`[INFO] Member move from ${oldChannel.id} to ${newChannel.id}`)
  voiceUpdate()
  const tags = [
    `new-channel:${newChannel.id}`,
    `old-channel:${oldChannel.id}`,
    `user:${member.id}`
  ]
  if ((newChannel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(newChannel as GuildChannel).guild.id}`)
  }
  dd.increment(`voice.switch`, 1, tags)
})

bot.on('voiceChannelLeave', (member, channel) => {
  console.log(`[INFO] Member left ${channel.id}`)
  voiceUpdate()
  const tags = [
    `channel:${channel.id}`,
    `user:${member.id}`
  ]
  if ((channel as GuildChannel).guild !== undefined) {
    tags.push(`guild:${(channel as GuildChannel).guild.id}`)
  }
  dd.increment(`voice.leaves`, 1, tags)
})

bot.on('ready', () => {
  console.log(`[INFO] Ready, logged in to Discord as ${bot.user.username}#${bot.user.discriminator}`)
})

bot.on('disconnect', () => {
  console.log('Disconnnected, reconnecting...')
})

bot.on('connect', () => {
  console.log('Connected')
})

process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM recieved, disconnecting..')
  bot.disconnect({
    reconnect: false
  })
  dd.flush()
})

setInterval(() => {
  if (!(bot as any).ready) {
    return
  }
  console.log('[INFO] Collecting user status')
  statusUpdate()
  console.log('[INFO] Collecting voice members')
  voiceUpdate()
}, 3000)

bot.connect()
  .catch(console.error)
