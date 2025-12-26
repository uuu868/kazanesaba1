const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeautoreply')
    .setDescription('このチャンネルの自動返信メッセージを削除します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(client, interaction) {
    const fs = require('fs');
    const autoRepliesFilePath = './auto_replies.json';
    
    try {
      const channelId = interaction.channel.id;

      if (!fs.existsSync(autoRepliesFilePath)) {
        await interaction.reply({
          content: '❌ このチャンネルには自動返信が設定されていません。',
          ephemeral: true
        });
        return;
      }

      const rawData = fs.readFileSync(autoRepliesFilePath);
      let autoReplies = JSON.parse(rawData);

      if (!autoReplies[channelId]) {
        await interaction.reply({
          content: '❌ このチャンネルには自動返信が設定されていません。',
          ephemeral: true
        });
        return;
      }

      delete autoReplies[channelId];
      fs.writeFileSync(autoRepliesFilePath, JSON.stringify(autoReplies, null, 4));

      await interaction.reply({
        content: '✅ このチャンネルの自動返信が削除されました。',
        ephemeral: true
      });

      console.log(`自動返信が削除されました: チャンネル=${interaction.channel.name}, 削除者=${interaction.user.tag}`);
    } catch (error) {
      console.error('removeautoreply コマンドエラー:', error);
      await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    }
  },
};
