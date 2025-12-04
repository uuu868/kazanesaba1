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
const fs = require('node:fs');
const path = require('node:path');

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

// スレッド作成に反応するロールID
const triggerRoleIds = [
  "1174906387655041099", //カザネ鯖ロールID オープン募集
  "1174908040890306570", //サモラン募集
  "1174908195995668510", //プラベ募集
  "1194886732462694490", //対抗戦募集
  "1194887079679758356", //大会募集
  "1146366170107232266", //マイクラ募集
  "1174908489341075537", //他ゲーム募集
  "1174908272415887401", //雑談募集
  "1321113824924794974", //カザクラ
];

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const mentionedRoles = message.mentions.roles;
  const hasTriggerRole = triggerRoleIds.some((roleId) => mentionedRoles.has(roleId));

  if (hasTriggerRole && mentionedRoles.size > 0) {
    const threadName = message.content.replace(/<@&\d+>/g, '').trim();

    if (!threadName) {
      const replyMessage = await message.reply({
        content: "募集要項をメンションの後に付け足して再度メッセージを送信してください。",
      });
      setTimeout(() => replyMessage.delete(), 10000); // 5秒後に削除
      return;
    }

    try {
      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: 1440, // 24時間
        reason: "メンションに反応してスレッドを作成",
      });

      console.log(`スレッド作成: スレッド名 = ${thread.name}, 作成者 = ${message.author.tag} (${message.author.id}), 作成日時 = ${new Date().toLocaleString()}`);

      await thread.send(`${message.author} がスレッドを開始しました。`);
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

      await thread.send({ content: '', components: [actionRow] });
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
          await interaction.reply({ content: '新しいスレッド名をこのスレッドに送信してください。30秒後に自動的にキャンセルされます。', ephemeral: true });

          const filter = response => response.author.id === user.id;
          const collected = await channel.awaitMessages({ filter, max: 1, time: 30000 });

          if (collected.size > 0) {
            const newName = collected.first().content;
            await thread.setName(newName);

            console.log(`スレッド名が変更されました: 新しいスレッド名 = ${newName}`);

            await interaction.followUp({ content: `スレッド名が「${newName}」に変更されました。`, ephemeral: true });
          } else {
            await interaction.followUp({ content: 'スレッド名の変更がキャンセルされました。変更する場合はもう一度「スレッド名を変更」ボタンを押してください。', ephemeral: true });
          }
        } else if (customId === 'delete_thread') {
          const confirmationRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('confirm_delete_thread')
                .setLabel('削除します')
                .setStyle(ButtonStyle.Danger)
            );

          await interaction.reply({ content: '本当にスレッドを削除しますか？この操作は取り消せません。', components: [confirmationRow], ephemeral: true });
        } else if (customId === 'confirm_delete_thread') {
          await thread.delete();
          await interaction.reply({ content: 'スレッドが削除されました。', ephemeral: true });
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
