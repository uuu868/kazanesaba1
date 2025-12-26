const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pinnedlist')
    .setDescription('このチャンネルのピン留めメッセージ一覧を表示します'),
  async execute(client, interaction) {
    const fs = require('fs');
    const pinnedMessagesFilePath = './pinned_messages.json';
    
    try {
      await interaction.deferReply({ ephemeral: true });

      // ピン留めメッセージを読み込む
      let pinnedData = {};
      if (fs.existsSync(pinnedMessagesFilePath)) {
        const rawData = fs.readFileSync(pinnedMessagesFilePath);
        pinnedData = JSON.parse(rawData);
      }

      const channelId = interaction.channel.id;
      const pinnedMessages = pinnedData[channelId] || [];

      if (pinnedMessages.length === 0) {
        await interaction.editReply('このチャンネルにはピン留めされたメッセージがありません。');
        return;
      }

      // メッセージリストを作成
      let messageList = `**📌 ピン留めメッセージ一覧 (${pinnedMessages.length}件)**\n\n`;
      
      for (let i = 0; i < Math.min(pinnedMessages.length, 10); i++) {
        const msg = pinnedMessages[i];
        const user = await client.users.fetch(msg.authorId).catch(() => null);
        const userName = user ? user.tag : '不明なユーザー';
        const timestamp = new Date(msg.timestamp).toLocaleString('ja-JP');
        const preview = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
        
        messageList += `${i + 1}. **${userName}** (${timestamp})\n`;
        messageList += `   メッセージID: ${msg.messageId}\n`;
        messageList += `   内容: ${preview || '(内容なし)'}\n`;
        messageList += `   [メッセージへ移動](https://discord.com/channels/${interaction.guildId}/${channelId}/${msg.messageId})\n\n`;
      }

      if (pinnedMessages.length > 10) {
        messageList += `\n...他${pinnedMessages.length - 10}件のピン留めメッセージがあります`;
      }

      await interaction.editReply(messageList);
    } catch (error) {
      console.error('pinnedlist コマンドエラー:', error);
      await interaction.editReply('エラーが発生しました。');
    }
  },
};
