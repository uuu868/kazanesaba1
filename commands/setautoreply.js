const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautoreply')
    .setDescription('このチャンネルで自動返信メッセージを設定します（埋め込み形式）')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('埋め込みメッセージのタイトル')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('埋め込みメッセージの説明文')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('埋め込みの色（例: #FF0000, Red, 赤）')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('footer')
        .setDescription('埋め込みのフッター（下部のテキスト）')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(client, interaction) {
    const fs = require('fs');
    const autoRepliesFilePath = './auto_replies.json';
    
    try {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color') || '#0099ff';
      const footer = interaction.options.getString('footer') || null;
      const channelId = interaction.channel.id;

      // 自動返信を設定
      let autoReplies = {};
      if (fs.existsSync(autoRepliesFilePath)) {
        const rawData = fs.readFileSync(autoRepliesFilePath);
        autoReplies = JSON.parse(rawData);
      }

      autoReplies[channelId] = {
        embed: {
          title: title,
          description: description,
          color: color,
          footer: footer
        },
        enabled: true,
        createdAt: new Date().toISOString(),
        createdBy: interaction.user.id
      };

      fs.writeFileSync(autoRepliesFilePath, JSON.stringify(autoReplies, null, 4));

      // プレビュー用の埋め込みを作成
      const previewEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);
      
      if (footer) {
        previewEmbed.setFooter({ text: footer });
      }

      await interaction.reply({
        content: '✅ このチャンネルで自動返信が設定されました。\n\n**プレビュー:**',
        embeds: [previewEmbed],
        ephemeral: true
      });

      console.log(`自動返信が設定されました: チャンネル=${interaction.channel.name}, 設定者=${interaction.user.tag}`);
    } catch (error) {
      console.error('setautoreply コマンドエラー:', error);
      await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    }
  },
};
