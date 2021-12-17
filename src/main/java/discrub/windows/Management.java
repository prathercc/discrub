package discrub.windows;

import javax.swing.JPanel;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.JTabbedPane;
import javax.swing.SwingUtilities;

import discrub.domain.Channel;
import discrub.domain.Conversation;
import discrub.domain.DiscordAccount;
import discrub.domain.Message;
import discrub.services.AccountService;
import discrub.services.MessageService;
import discrub.windows.management.Delete;
import discrub.windows.management.Edit;

import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.LayoutStyle.ComponentPlacement;
import java.awt.event.ActionListener;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.awt.Component;
import java.awt.Point;
import java.awt.event.ActionEvent;
import javax.swing.JProgressBar;

@SuppressWarnings("serial")
public class Management extends JPanel {
	/**
	 * Create the panel.
	 */
	public Management(Object o, DiscordAccount discordAccount) {
		JTabbedPane tabbedPane = new JTabbedPane(JTabbedPane.TOP);
		
		JButton btnNewButton = new JButton("Back");
		
		JProgressBar progressBar = new JProgressBar();
		progressBar.setMaximum(1000);

		GroupLayout groupLayout = new GroupLayout(this);
		groupLayout.setHorizontalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addContainerGap()
					.addGroup(groupLayout.createParallelGroup(Alignment.LEADING, false)
						.addGroup(groupLayout.createSequentialGroup()
							.addComponent(btnNewButton)
							.addPreferredGap(ComponentPlacement.RELATED, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
							.addComponent(progressBar, GroupLayout.PREFERRED_SIZE, 186, GroupLayout.PREFERRED_SIZE))
						.addComponent(tabbedPane, GroupLayout.PREFERRED_SIZE, 278, GroupLayout.PREFERRED_SIZE))
					.addContainerGap(80, Short.MAX_VALUE))
		);
		groupLayout.setVerticalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addComponent(tabbedPane, GroupLayout.PREFERRED_SIZE, 195, GroupLayout.PREFERRED_SIZE)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addGroup(groupLayout.createParallelGroup(Alignment.TRAILING, false)
						.addComponent(progressBar, GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
						.addComponent(btnNewButton, GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
					.addContainerGap(GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
		);
		
		MessageService msgService = new MessageService();
		AccountService as = new AccountService();
		
		Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
            	progressBar.setValue(progressBar.getValue() + 5);
            	List<Message> messageList = new ArrayList<Message>();
            	if(o instanceof Conversation) {
        			Conversation conversation = (Conversation) o;
        			boolean reachedEnd = false;
        			String lastId = "";
        			progressBar.setValue(20);
        			while (reachedEnd != true) {
        				progressBar.setValue(progressBar.getValue() + 5);
        				List<Message> newMessagesList = msgService.fetchConversationMessages(lastId, conversation, discordAccount);
        				if (newMessagesList.size() < 100) {
        					reachedEnd = true; // If the data length was less than 100, we know we have reached the end
        				}
        				messageList.addAll(newMessagesList); // Populate our messageList with the additional data
        				if(newMessagesList.size() > 0) {
        					lastId = newMessagesList.get(newMessagesList.size() - 1).getId(); // Save the last id we are on
        				}
        			}
        			messageList = as.attachReferences(messageList, conversation.getRecipients());
        		}
        		else if (o instanceof Channel) {
        			Channel channel = (Channel) o;
        			boolean reachedEnd = false;
        			String lastId = "";
        			progressBar.setValue(20);
        			while (reachedEnd != true) {
        				progressBar.setValue(progressBar.getValue() + 5);
        				List<Message> newMessagesList = msgService.fetchChannelMessages(lastId, channel, discordAccount);
        				if (newMessagesList.size() < 100) {
        					reachedEnd = true; // If the data length was less than 100, we know we have reached the end
        				}
        				messageList.addAll(newMessagesList); // Populate our messageList with the additional data
        				lastId = newMessagesList.size() != 0 ? newMessagesList.get(newMessagesList.size() - 1).getId() : "";
        			}
        			messageList = as.attachReferences(messageList, channel.getParticipatingUsers());
        		}
            	try {
                	while(progressBar.getValue() < 1000) {
                		Thread.sleep(1);
                		progressBar.setValue(progressBar.getValue() + 1);
                	}
            	}
            	catch(Exception e) {}
            	
            	messageList = messageList.stream().filter(x -> x.getAuthor().getUsername().equalsIgnoreCase(discordAccount.getUser().getUsername())).collect(Collectors.toList());
        		tabbedPane.addTab("Edit", null, new Edit(o, discordAccount, messageList), null);
        		tabbedPane.addTab("Delete", null, new Delete(o, discordAccount, messageList), null);
        		progressBar.setEnabled(false);
        		
            }
        });         
		setLayout(groupLayout);
        thread.start();
		btnNewButton.addActionListener(new ActionListener() {
			@SuppressWarnings("deprecation")
			public void actionPerformed(ActionEvent e) {
				thread.stop();
				JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
				main.setContentPane(new Configuration(discordAccount));
				Point oldLoc = main.getLocation();
				main.setVisible(false);
				main.setBounds(100, 100, 249, 197);
				main.setLocation(oldLoc);
				main.setVisible(true);
				main.revalidate();
				main.repaint();
			}
		});
	}
}
