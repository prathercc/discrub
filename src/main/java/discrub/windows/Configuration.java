package discrub.windows;

import javax.swing.JPanel;
import javax.swing.JButton;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;

import javax.swing.JComboBox;
import javax.swing.JFrame;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JLabel;
import javax.swing.LayoutStyle.ComponentPlacement;

import discrub.domain.DiscordAccount;
import discrub.domain.Guild;

import javax.swing.SwingUtilities;

import java.awt.event.ActionListener;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ItemListener;
import java.awt.event.ItemEvent;

@SuppressWarnings("serial")
public class Configuration extends JPanel {

	/**
	 * Create the panel.
	 */
	@SuppressWarnings({ "rawtypes", "unchecked" })
	public Configuration(DiscordAccount discordAccount) {
		JComboBox conversationComboBox = new JComboBox();
		JLabel lblNewLabel = new JLabel("Conversations:");
		JLabel lblChannels = new JLabel("Channels:");
		JComboBox channelsComboBox = new JComboBox();
		JComboBox guildsComboBox = new JComboBox();
		JButton loadChannelButton = new JButton("Load");
		JButton loadConversationButton = new JButton("Load");
		JButton backButton = new JButton("Back");
		GroupLayout groupLayout = new GroupLayout(this);
		groupLayout.setHorizontalGroup(
			groupLayout.createParallelGroup(Alignment.TRAILING)
				.addGroup(groupLayout.createSequentialGroup()
					.addContainerGap()
					.addGroup(groupLayout.createParallelGroup(Alignment.LEADING)
						.addGroup(groupLayout.createSequentialGroup()
							.addGroup(groupLayout.createParallelGroup(Alignment.TRAILING, false)
								.addComponent(guildsComboBox, Alignment.LEADING, 0, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
								.addComponent(lblNewLabel, Alignment.LEADING)
								.addComponent(conversationComboBox, Alignment.LEADING, 0, 116, Short.MAX_VALUE)
								.addComponent(lblChannels, Alignment.LEADING, GroupLayout.PREFERRED_SIZE, 73, GroupLayout.PREFERRED_SIZE)
								.addComponent(channelsComboBox, Alignment.LEADING, 0, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
							.addPreferredGap(ComponentPlacement.RELATED)
							.addGroup(groupLayout.createParallelGroup(Alignment.LEADING, false)
								.addComponent(loadChannelButton, GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
								.addComponent(loadConversationButton, GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)))
						.addComponent(backButton))
					.addContainerGap(263, Short.MAX_VALUE))
		);
		groupLayout.setVerticalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addContainerGap()
					.addComponent(lblNewLabel)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addGroup(groupLayout.createParallelGroup(Alignment.BASELINE)
						.addComponent(conversationComboBox, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
						.addComponent(loadConversationButton))
					.addGap(27)
					.addComponent(lblChannels)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(guildsComboBox, GroupLayout.PREFERRED_SIZE, 20, GroupLayout.PREFERRED_SIZE)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addGroup(groupLayout.createParallelGroup(Alignment.BASELINE)
						.addComponent(channelsComboBox, GroupLayout.PREFERRED_SIZE, 20, GroupLayout.PREFERRED_SIZE)
						.addComponent(loadChannelButton))
					.addGap(27)
					.addComponent(backButton)
					.addContainerGap(100, Short.MAX_VALUE))
		);

		conversationComboBox.setModel(new DefaultComboBoxModel(discordAccount.getConversations().toArray()));
		
		guildsComboBox.setModel(new DefaultComboBoxModel(discordAccount.getGuilds().toArray()));

		guildsComboBox.addItemListener(new ItemListener() {
			public void itemStateChanged(ItemEvent e) {
				Guild selectedGuild = (Guild) guildsComboBox.getSelectedItem();
				channelsComboBox.setModel(new DefaultComboBoxModel(selectedGuild.getChannels().toArray()));
			}
		});

		loadChannelButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
				main.setContentPane(new Management(channelsComboBox.getSelectedItem(), discordAccount));
				main.revalidate();
				main.repaint();
			}
		});

		loadConversationButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
				main.setContentPane(new Management(conversationComboBox.getSelectedItem(), discordAccount));
				main.revalidate();
				main.repaint();
			}
		});

		backButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
				main.setContentPane(new Login());
				main.revalidate();
				main.repaint();
			}
		});

		setLayout(groupLayout);

		Guild selectedGuild = (Guild) guildsComboBox.getSelectedItem();
		if (selectedGuild != null)
			channelsComboBox.setModel(new DefaultComboBoxModel(selectedGuild.getChannels().toArray()));
	}
}
