import { CommandClient, Message, GuildChannel } from 'eris'
import dd from 'datadog-metrics'

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
    dd.gauge(`members_${guild.id}.online`, guildStatus.online)
    dd.gauge(`members_${guild.id}.idle`, guildStatus.idle)
    dd.gauge(`members_${guild.id}.dnd`, guildStatus.dnd)
    dd.gauge(`members_${guild.id}.offline`, guildStatus.offline)
  })

  dd.gauge('users.online', status.online)
  dd.gauge('users.idle', status.idle)
  dd.gauge('users.dnd', status.dnd)
  dd.gauge('users.offline', status.offline)
}

const bot = new CommandClient(process.env.TOKEN)
dd.init({
  prefix: 'dev.bots.nookstats.',
  apiKey: process.env.DATADOG_KEY
})

bot.on('messageCreate', msg => {
  dd.increment(`message.creates`)
  dd.increment(`message.creates_${msg.channel.id}`)
  switch (msg.channel.type) {
    case 0:
      dd.increment(`guild-message.creates_${(msg.channel as GuildChannel).guild.id}`)
      break
    case 1:
      dd.increment(`dm-message.creates`)
      break
  }
})

bot.on('messageUpdate', msg => {
  dd.increment(`message.edits`)
  dd.increment(`message.edits_${msg.channel.id}`)
  switch (msg.channel.type) {
    case 0:
      dd.increment(`guild-message.edits_${(msg.channel as GuildChannel).guild.id}`)
      break
    case 1:
      dd.increment(`dm-message.edits`)
      break
  }
})

bot.on('messageDelete', msg => {
  dd.increment(`message.deletes`)
  dd.increment(`message.deletes_${msg.channel.id}`)
  if (!msg.channel) {
    return
  }
  switch (msg.channel.type) {
    case 0:
      dd.increment(`guild-message.deletes_${(msg.channel as GuildChannel).guild.id}`)
      break
    case 1:
      dd.increment(`dm-message.deletes`)
      break
  }
})

bot.on('guildMemberAdd', guild => {
  dd.increment(`member.joins_${guild.id}`)
})

bot.on('guildMemberRemove', guild => {
  dd.increment(`member.removes_${guild.id}`)
})

bot.on('presenceUpdate', statusUpdate)

setInterval(statusUpdate, 5000)

bot.connect()
  .catch(console.error)
