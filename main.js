const { Client, Collection, Events, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

require('dotenv').config();
const fs = require('fs');
const path = require('path');

//-----------commands------------

require("./deploy-commands.js");

//--------------------コマンドを読み込む--------------------------
//スラッシュコマンド
client.commands = new Collection();
const slashcommandsPath = path.join(__dirname, 'commands');
const slashcommandFiles = fs.readdirSync(slashcommandsPath).filter(file => file.endsWith('.js'));

for (const file of slashcommandFiles) {
	const slashfilePath = path.join(slashcommandsPath, file);
	const command = require(slashfilePath);
  console.log(`-> [Loaded Command] ${file.split('.')[0]}`);
	client.commands.set(command.data.name, command);
}

//イベントコマンド
const eventsPath = path.join(__dirname, 'events');
const eventsFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventsFiles) {
	const eventfilePath = path.join(eventsPath, file);
	const event = require(eventfilePath);
  if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
  console.log(`-> [Loaded Event] ${file.split('.')[0]}`);
}

client.once(Events.ClientReady, () => {
  console.log('Bot is online!');
});

// データファイルパス
const dataFilePath = './thread_creators.json';
const pinnedMessagesFilePath = './pinned_messages.json';
const autoRepliesFilePath = './auto_replies.json';

function loadThreadCreators() {
  if (!fs.existsSync(dataFilePath)) {
    return {}; 
  }
  const rawData = fs.readFileSync(dataFilePath);
  return JSON.parse(rawData);
}

function saveThreadCreators(data) {
  const jsonData = JSON.stringify(data, null, 4); 
  fs.writeFileSync(dataFilePath, jsonData);
}

function saveThreadCreator(threadId, creatorId) {
  const data = loadThreadCreators();
  data[threadId] = creatorId;
  saveThreadCreators(data);
}

function getThreadCreator(threadId) {
  const data = loadThreadCreators();
  return data[threadId];
}

// 自動返信管理関数
function loadAutoReplies() {
  if (!fs.existsSync(autoRepliesFilePath)) {
    return {}; 
  }
  const rawData = fs.readFileSync(autoRepliesFilePath);
  return JSON.parse(rawData);
}

function saveAutoReplies(data) {
  const jsonData = JSON.stringify(data, null, 4); 
  fs.writeFileSync(autoRepliesFilePath, jsonData);
}

function setAutoReply(channelId, message) {
  const data = loadAutoReplies();
  data[channelId] = {
    message: message,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastMessageId: null
  };
  saveAutoReplies(data);
}

function removeAutoReply(channelId) {
  const data = loadAutoReplies();
  delete data[channelId];
  saveAutoReplies(data);
}

function getAutoReply(channelId) {
  const data = loadAutoReplies();
  return data[channelId];
}

function getAllAutoReplies() {
  return loadAutoReplies();
}

// 固定メッセージ管理関数
function loadPinnedMessages() {
  if (!fs.existsSync(pinnedMessagesFilePath)) {
    return {}; 
  }
  const rawData = fs.readFileSync(pinnedMessagesFilePath);
  return JSON.parse(rawData);
}

function savePinnedMessages(data) {
  const jsonData = JSON.stringify(data, null, 4); 
  fs.writeFileSync(pinnedMessagesFilePath, jsonData);
}

function savePinnedMessage(channelId, messageId, content, authorId) {
  const data = loadPinnedMessages();
  if (!data[channelId]) {
    data[channelId] = [];
  }
  data[channelId].push({
    messageId: messageId,
    content: content,
    authorId: authorId,
    timestamp: new Date().toISOString()
  });
  savePinnedMessages(data);
}

function removePinnedMessage(channelId, messageId) {
  const data = loadPinnedMessages();
  if (data[channelId]) {
    data[channelId] = data[channelId].filter(msg => msg.messageId !== messageId);
    if (data[channelId].length === 0) {
      delete data[channelId];
    }
    savePinnedMessages(data);
  }
}

function getPinnedMessages(channelId) {
  const data = loadPinnedMessages();
  return data[channelId] || [];
}

// 安全にチャンネルへ送信（チャンネルが消えている等のエラーを握りつぶす）
async function safeSendChannel(channel, contentOrOptions) {
  try {
    if (!channel) return null;
    return await channel.send(contentOrOptions);
  } catch (err) {
    if (err && err.code === 10003) {
      console.warn('Unknown Channel — send skipped');
      return null;
    }
    console.error('channel.send error', err);
    return null;
  }
}

// 安全に interaction.reply
async function safeInteractionReply(interaction, options) {
  try {
    return await interaction.reply(options);
  } catch (err) {
    if (err && err.code === 10003) {
      console.warn('Unknown Channel — interaction.reply skipped');
      return null;
    }
    console.error('interaction.reply error', err);
    return null;
  }
}

// 安全に interaction.followUp
async function safeInteractionFollowUp(interaction, options) {
  try {
    return await interaction.followUp(options);
  } catch (err) {
    if (err && err.code === 10003) {
      console.warn('Unknown Channel — interaction.followUp skipped');
      return null;
    }
    console.error('interaction.followUp error', err);
    return null;
  }
}

// スレッド作成に反応するロールID
const triggerRoleIds = [
  "1174906387655041099", //カザネ鯖ロールID オープン募集
  "1174908040890306570", //サモラン募集
  "1174908195995668510", //プラベ募集
  "1194886732462694490", //対抗戦募集
  "1194887079679758356", //大会募集
  "1146366170107232266", //マイクラ募集
  "1174908489341075537", //他ゲーム募集
  "1321113824924794974", //カザクラ
];

// メッセージピン留め機能
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (user.bot) return;
    
    // リアクションが取得できていない場合はフェッチ
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('リアクションのフェッチに失敗しました:', error);
        return;
      }
    }

    // 📌絵文字でピン留め
    if (reaction.emoji.name === '📌') {
      const message = reaction.message;
      
      try {
        // メッセージをピン留め
        if (!message.pinned) {
          // 既存のピン留めメッセージを取得
          const existingPinnedMessages = getPinnedMessages(message.channel.id);
          
          // 古いピン留めメッセージを削除
          for (const pinnedMsg of existingPinnedMessages) {
            try {
              const oldMessage = await message.channel.messages.fetch(pinnedMsg.messageId);
              if (oldMessage && oldMessage.pinned) {
                await oldMessage.unpin();
                console.log(`古いピン留めメッセージを解除しました: メッセージID=${pinnedMsg.messageId}`);
              }
            } catch (error) {
              console.error(`古いメッセージの取得またはピン解除に失敗しました: ${error}`);
            }
          }
          
          // 新しいメッセージをピン留め
          await message.pin();
          
          // データをクリアして新しいメッセージのみを保存
          const data = loadPinnedMessages();
          data[message.channel.id] = [{
            messageId: message.id,
            content: message.content,
            authorId: message.author.id,
            timestamp: new Date().toISOString()
          }];
          savePinnedMessages(data);
          
          console.log(`メッセージがピン留めされました: チャンネル=${message.channel.name}, メッセージID=${message.id}, ピン留めしたユーザー=${user.tag}`);
        }
      } catch (error) {
        console.error('メッセージのピン留めに失敗しました:', error);
      }
    }
  } catch (error) {
    console.error('MessageReactionAdd エラー:', error);
  }
});

// メッセージピン解除機能
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  try {
    if (user.bot) return;
    
    // リアクションが取得できていない場合はフェッチ
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('リアクションのフェッチに失敗しました:', error);
        return;
      }
    }

    // 📌絵文字が全て削除されたらピン解除
    if (reaction.emoji.name === '📌') {
      const message = reaction.message;
      
      // 📌リアクションが0になったか確認
      if (reaction.count === 0) {
        try {
          if (message.pinned) {
            await message.unpin();
            removePinnedMessage(message.channel.id, message.id);
            console.log(`メッセージのピン留めが解除されました: チャンネル=${message.channel.name}, メッセージID=${message.id}`);
          }
        } catch (error) {
          console.error('メッセージのピン解除に失敗しました:', error);
        }
      }
    }
  } catch (error) {
    console.error('MessageReactionRemove エラー:', error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 自動返信機能をチェック（スレッド作成より先に実行）
  const autoReply = getAutoReply(message.channel.id);
  if (autoReply && autoReply.enabled && autoReply.embed) {
    try {
      // 古い自動返信メッセージを削除
      if (autoReply.lastMessageId) {
        try {
          const oldMessage = await message.channel.messages.fetch(autoReply.lastMessageId);
          if (oldMessage) {
            await oldMessage.delete();
            console.log(`古い自動返信メッセージを削除しました: メッセージID=${autoReply.lastMessageId}`);
          }
        } catch (error) {
          console.error(`古い自動返信メッセージの削除に失敗しました: ${error}`);
        }
      }
      
      // 新しい自動返信メッセージを送信
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(autoReply.embed.title)
        .setDescription(autoReply.embed.description)
        .setColor(autoReply.embed.color || '#0099ff');
      
      if (autoReply.embed.footer) {
        embed.setFooter({ text: autoReply.embed.footer });
      }
      
      const sentMessage = await safeSendChannel(message.channel, { embeds: [embed] });
      
      // 送信したメッセージIDを保存
      if (sentMessage) {
        const data = loadAutoReplies();
        if (data[message.channel.id]) {
          data[message.channel.id].lastMessageId = sentMessage.id;
          saveAutoReplies(data);
        }
      }
    } catch (error) {
      console.error('自動返信の送信に失敗しました:', error);
    }
  }

  const mentionedRoles = message.mentions.roles;
  const hasTriggerRole = triggerRoleIds.some((roleId) => mentionedRoles.has(roleId));

  if (hasTriggerRole && mentionedRoles.size > 0) {
    const threadName = message.content.replace(/<@&\d+>/g, '').trim();

    if (!threadName) {
        const replyMessage = await message.reply({
          content: "募集要項をメンションの後に付け足して再度メッセージを送信してください。",
        });
        setTimeout(async () => {
          try {
            if (replyMessage && typeof replyMessage.delete === 'function') await replyMessage.delete();
          } catch (e) {
            if (e && e.code === 10003) {
              console.warn('Unknown Channel — delete skipped');
            } else {
              console.error('replyMessage.delete error', e);
            }
          }
        }, 5000); // 5秒後に削除
      return;
    }

    try {
      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: 1440, // 24時間
        reason: "メンションに反応してスレッドを作成",
      });

      console.log(`スレッド作成: スレッド名 = ${thread.name}, 作成者 = ${message.author.tag} (${message.author.id}), 作成日時 = ${new Date().toLocaleString()}`);

      await safeSendChannel(thread, `${message.author} がスレッドを開始しました。`);
      saveThreadCreator(thread.id, message.author.id);

      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('rename_thread')
            .setLabel('スレッド名を変更')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('delete_thread')
            .setLabel('スレッドを削除')
            .setStyle(ButtonStyle.Danger)
        );

      await safeSendChannel(thread, { content: '', components: [actionRow] });
    } catch (error) {
      console.error("スレッド作成時にエラーが発生しました", error);
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(client, interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'コマンドがありません', ephemeral: true });
      }
    } else if (interaction.isButton()) {
      const { customId, channel, user } = interaction;

      if (!channel || !channel.isThread()) {
        console.error('スレッドが存在しません');
        return;
      }

      const thread = channel; 
      const creatorId = getThreadCreator(thread.id);

      if (!creatorId) {
        await interaction.reply({ content: 'このスレッドの作成者情報が見つかりませんでした。', ephemeral: true });
        return;
      }

      if (interaction.user.id === creatorId) {
        if (customId === 'rename_thread') {
        await safeInteractionReply(interaction, { content: '新しいスレッド名をこのスレッドに送信してください。30秒後に自動的にキャンセルされます。', flags: 64 });

        const filter = response => response.author.id === user.id;
        const collected = await channel.awaitMessages({ filter, max: 1, time: 30000 });

        if (collected.size > 0) {
          const newName = collected.first().content;
          try { await thread.setName(newName); } catch (e) { if (e && e.code === 10003) console.warn('Unknown Channel — setName skipped'); else console.error(e); }

          console.log(`スレッド名が変更されました: 新しいスレッド名 = ${newName}`);

          await safeInteractionFollowUp(interaction, { content: `スレッド名が「${newName}」に変更されました。`, flags: 64 });
        } else {
          await safeInteractionFollowUp(interaction, { content: 'スレッド名の変更がキャンセルされました。変更する場合はもう一度「スレッド名を変更」ボタンを押してください。', flags: 64 });
        }
        } else if (customId === 'delete_thread') {
        const confirmationRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_delete_thread')
              .setLabel('削除します')
              .setStyle(ButtonStyle.Danger)
          );

        await safeInteractionReply(interaction, { content: '本当にスレッドを削除しますか？この操作は取り消せません。', components: [confirmationRow], flags: 64 });
        } else if (customId === 'confirm_delete_thread') {
        try { await thread.delete(); } catch (e) { if (e && e.code === 10003) console.warn('Unknown Channel — delete skipped'); else console.error(e); }
        await safeInteractionReply(interaction, { content: 'スレッドが削除されました。', flags: 64 });
        }
      } else {
        await interaction.reply({ content: 'あなたにはこの操作を行う権限がありません。', ephemeral: true });
      }
    }
  } catch (error) {
    console.error('エラーが発生しました', error);
  }
});

client.login(process.env.TOKEN);
