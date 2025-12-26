const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listautoreplies')
    .setDescription('サーバー内の全ての自動返信設定を表示します'),
  async execute(client, interaction) {
    const fs = require('fs');
    const autoRepliesFilePath = './auto_replies.json';
    
    try {
      await interaction.deferReply({ ephemeral: true });

      if (!fs.existsSync(autoRepliesFilePath)) {
        await interaction.editReply('このサーバーには自動返信が設定されていません。');
        return;
      }

      const rawData = fs.readFileSync(autoRepliesFilePath);
      const autoReplies = JSON.parse(rawData);

      if (Object.keys(autoReplies).length === 0) {
        await interaction.editReply('このサーバーには自動返信が設定されていません。');
        return;
      }

      let replyList = '**🤖 自動返信設定一覧**\n\n';
      let count = 0;

      for (const [channelId, config] of Object.entries(autoReplies)) {
        count++;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        const channelName = channel ? channel.name : '不明なチャンネル';
        const creator = config.createdBy ? await client.users.fetch(config.createdBy).catch(() => null) : null;
        const creatorName = creator ? creator.tag : '不明';
        const timestamp = config.createdAt ? new Date(config.createdAt).toLocaleString('ja-JP') : '不明';
        
        replyList += `**${count}. #${channelName}**\n`;
        replyList += `   チャンネルID: ${channelId}\n`;
        
        if (config.embed) {
          replyList += `   タイトル: ${config.embed.title}\n`;
          replyList += `   説明: ${config.embed.description.substring(0, 50)}${config.embed.description.length > 50 ? '...' : ''}\n`;
          replyList += `   色: ${config.embed.color}\n`;
          if (config.embed.footer) replyList += `   フッター: ${config.embed.footer}\n`;
        } else {
          replyList += `   メッセージ: ${config.message}\n`;
        }
        
        replyList += `   設定者: ${creatorName}\n`;
        replyList += `   設定日時: ${timestamp}\n`;
        replyList += `   状態: ${config.enabled ? '✅ 有効' : '❌ 無効'}\n\n`;
      }

      // メッセージが2000文字を超える場合は分割
      if (replyList.length > 2000) {
        await interaction.editReply(replyList.substring(0, 1900) + '\n\n...(文字数制限により省略)');
      } else {
        await interaction.editReply(replyList);
      }
    } catch (error) {
      console.error('listautoreplies コマンドエラー:', error);
      await interaction.editReply('エラーが発生しました。');
    }
  },
};
