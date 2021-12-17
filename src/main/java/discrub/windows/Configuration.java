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
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.awt.event.ItemListener;
import java.awt.event.ItemEvent;
import java.awt.Font;

@SuppressWarnings("serial")
public class Configuration extends JPanel {

	/**
	 * Create the panel.
	 */
	@SuppressWarnings({ "rawtypes", "unchecked" })
	public Configuration(DiscordAccount discordAccount) {
		JComboBox conversationComboBox = new JComboBox();
		JLabel lblNewLabel = new JLabel("Conversations:");
		lblNewLabel.setFont(new Font("Tahoma", Font.BOLD, 11));
		JLabel lblChannels = new JLabel("Channels:");
		lblChannels.setFont(new Font("Tahoma", Font.BOLD, 11));
		JComboBox channelsComboBox = new JComboBox();
		JComboBox guildsComboBox = new JComboBox();
		JButton loadChannelButton = new JButton("Load");
		JButton loadConversationButton = new JButton("Load");
		JButton backButton = new JButton("Back");
		GroupLayout groupLayout = new GroupLayout(this);
		groupLayout.setHorizontalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addContainerGap()
					.addGroup(groupLayout.createParallelGroup(Alignment.LEADING)
						.addGroup(groupLayout.createSequentialGroup()
							.addGroup(groupLayout.createParallelGroup(Alignment.LEADING)
								.addComponent(lblChannels, GroupLayout.PREFERRED_SIZE, 73, GroupLayout.PREFERRED_SIZE)
								.addComponent(guildsComboBox, 0, 131, Short.MAX_VALUE)
								.addComponent(channelsComboBox, 0, 131, Short.MAX_VALUE)
								.addComponent(conversationComboBox, 0, 131, Short.MAX_VALUE))
							.addPreferredGap(ComponentPlacement.RELATED)
							.addGroup(groupLayout.createParallelGroup(Alignment.LEADING, false)
								.addComponent(loadChannelButton, GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
								.addComponent(loadConversationButton))
							.addGap(5))
						.addGroup(groupLayout.createSequentialGroup()
							.addComponent(backButton)
							.addContainerGap(142, Short.MAX_VALUE))
						.addGroup(groupLayout.createSequentialGroup()
							.addComponent(lblNewLabel)
							.addContainerGap(113, Short.MAX_VALUE))))
		);
		groupLayout.setVerticalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addGap(5)
					.addComponent(lblNewLabel)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addGroup(groupLayout.createParallelGroup(Alignment.LEADING)
						.addComponent(loadConversationButton)
						.addComponent(conversationComboBox, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE))
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(lblChannels)
					.addPreferredGap(ComponentPlacement.RELATED, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
					.addComponent(guildsComboBox, GroupLayout.PREFERRED_SIZE, 20, GroupLayout.PREFERRED_SIZE)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addGroup(groupLayout.createParallelGroup(Alignment.BASELINE)
						.addComponent(channelsComboBox, GroupLayout.PREFERRED_SIZE, 20, GroupLayout.PREFERRED_SIZE)
						.addComponent(loadChannelButton))
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(backButton)
					.addGap(153))
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
				Point oldLoc = main.getLocation();
				main.setVisible(false);
				main.setBounds(100, 100, 313, 285);
				main.setLocation(oldLoc);
				main.setVisible(true);
				main.revalidate();
				main.repaint();
			}
		});

		loadConversationButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
				main.setContentPane(new Management(conversationComboBox.getSelectedItem(), discordAccount));
				Point oldLoc = main.getLocation();
				main.setVisible(false);
				main.setBounds(100, 100, 313, 285);
				main.setLocation(oldLoc);
				main.setVisible(true);
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
