package discrub.windows;

import java.awt.Color;
import java.awt.Component;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.List;

import javax.swing.GroupLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.GroupLayout.Alignment;
import javax.swing.LayoutStyle.ComponentPlacement;
import javax.swing.border.EmptyBorder;

import discrub.domain.Authorization;
import discrub.domain.Conversation;
import discrub.domain.Credentials;
import discrub.domain.DiscordAccount;
import discrub.domain.Guild;
import discrub.domain.User;
import discrub.services.AuthenticationService;
import discrub.services.FileService;

@SuppressWarnings("serial")
public class Login extends JPanel {

	FileService ioService = new FileService();
	
	/**
	 * Create the panel.
	 */
	@SuppressWarnings("deprecation")
	public Login() {
		JPasswordField passwordTextField;
		setForeground(Color.MAGENTA);
		JCheckBox rememberMeCheckBox = new JCheckBox("Remember Me");
		JTextField emailTextField = new JTextField();
		emailTextField.setColumns(10);
		JLabel lblNewLabel_1 = new JLabel("Password:");
		JLabel lblNewLabel = new JLabel("Email:");
		passwordTextField = new JPasswordField();
		JButton emailSignInButton = new JButton("Sign-In");
		emailSignInButton.setEnabled(passwordTextField.getText().length() > 0 ? true : false);
		JLabel networkErrorText = new JLabel("Network Error Detected");
		networkErrorText.setForeground(Color.RED);
		networkErrorText.setVisible(false);
		
		//Checking if Remember Me checkbox is checked
		ioService.checkIniFolderPath();
		String iniValue = ioService.getIniValue();
		if (iniValue.length() != 0) {
			rememberMeCheckBox.setSelected(true);
			emailTextField.setText(iniValue);
		}

		this.setBorder(new EmptyBorder(5, 5, 5, 5));
		
		JLabel lblNewLabel_2 = new JLabel("Sign into Discord");
		lblNewLabel_2.setFont(new Font("Tahoma", Font.BOLD, 14));

		GroupLayout gl_loginMenu = new GroupLayout(this);
		gl_loginMenu.setHorizontalGroup(
			gl_loginMenu.createParallelGroup(Alignment.LEADING)
				.addGroup(gl_loginMenu.createSequentialGroup()
					.addGroup(gl_loginMenu.createParallelGroup(Alignment.LEADING)
						.addGroup(gl_loginMenu.createSequentialGroup()
							.addContainerGap()
							.addGroup(gl_loginMenu.createParallelGroup(Alignment.TRAILING)
								.addComponent(passwordTextField, Alignment.LEADING, GroupLayout.DEFAULT_SIZE, 420, Short.MAX_VALUE)
								.addComponent(lblNewLabel_1, Alignment.LEADING)
								.addComponent(lblNewLabel, Alignment.LEADING)
								.addComponent(rememberMeCheckBox, Alignment.LEADING)
								.addComponent(emailTextField, Alignment.LEADING, GroupLayout.DEFAULT_SIZE, 420, Short.MAX_VALUE)
								.addComponent(emailSignInButton)
								.addGroup(gl_loginMenu.createSequentialGroup()
									.addPreferredGap(ComponentPlacement.RELATED, 306, GroupLayout.PREFERRED_SIZE)
									.addComponent(networkErrorText))))
						.addGroup(gl_loginMenu.createSequentialGroup()
							.addGap(85)
							.addComponent(lblNewLabel_2)))
					.addContainerGap())
		);
		gl_loginMenu.setVerticalGroup(
			gl_loginMenu.createParallelGroup(Alignment.LEADING)
				.addGroup(gl_loginMenu.createSequentialGroup()
					.addContainerGap()
					.addComponent(lblNewLabel_2)
					.addGap(18)
					.addComponent(lblNewLabel)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(emailTextField, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(lblNewLabel_1)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(passwordTextField, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
					.addPreferredGap(ComponentPlacement.UNRELATED)
					.addComponent(rememberMeCheckBox)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(emailSignInButton)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addComponent(networkErrorText)
					.addContainerGap(83, Short.MAX_VALUE))
		);
		this.setLayout(gl_loginMenu);
		

		emailTextField.addKeyListener(new KeyAdapter() {
			@Override
			public void keyTyped(KeyEvent e) {
				if(passwordTextField.getPassword().length >= 1 && emailTextField.getText().length() >= 1) {
					emailSignInButton.setEnabled(true);
				}
				else {
					emailSignInButton.setEnabled(false);
				}
			}
		});
		passwordTextField.addKeyListener(new KeyAdapter() {
			@Override
			public void keyTyped(KeyEvent e) {
				if(passwordTextField.getPassword().length >= 1 && emailTextField.getText().length() >= 1) {
					emailSignInButton.setEnabled(true);
				}
				else {
					emailSignInButton.setEnabled(false);
				}
				if(e.getKeyChar()==KeyEvent.VK_ENTER && emailSignInButton.isEnabled()) {
					emailSignInButton.doClick();
				}
			}
		});
		
		emailSignInButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				Thread thread = new Thread(new Runnable() {
                    @Override
                    public void run() {
                    	JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
                    	networkErrorText.setVisible(false);
        				emailSignInButton.setEnabled(false);
        				emailTextField.setEnabled(false);
        				passwordTextField.setEnabled(false);
        				rememberMeCheckBox.setEnabled(false);
        				Credentials credentials = new Credentials(emailTextField.getText(), passwordTextField.getText());
        				DiscordAccount discordAccount = createDiscordAccount(credentials);
        				if(discordAccount != null) {
        					ioService.setIniValue(emailTextField.getText());
        					Configuration configuration = new Configuration(discordAccount);
        					main.setContentPane(configuration);
        					main.revalidate();
        					main.repaint();
        				}
        				else {
        					networkErrorText.setVisible(true);
        					emailSignInButton.setEnabled(true);
        					emailTextField.setEnabled(true);
        					passwordTextField.setEnabled(true);
        					rememberMeCheckBox.setEnabled(true);
        					passwordTextField.requestFocus();
        				}
                    }
                });         
                thread.start();
			}
		});
	}
	private DiscordAccount createDiscordAccount(Credentials credentials) {
		AuthenticationService service = new AuthenticationService();
		DiscordAccount discordAccount = new DiscordAccount(credentials);
		Authorization authorization = service.fetchAuthorization(credentials);
		if (authorization != null) {
			try {
				discordAccount.setAuthorization(authorization);
				User userdata = service.fetchUserData(discordAccount);
				discordAccount.setUser(userdata);
				List<Conversation> conversations = service.fetchConversations(discordAccount);
				discordAccount.setConversations(conversations);
				List<Guild> guilds = service.fetchGuilds(discordAccount);
				guilds.stream().forEach(guild -> guild.setChannels(service.fetchChannels(guild, discordAccount)));
				discordAccount.setGuilds(guilds);
				return userdata != null ? discordAccount : null;
			} catch (Exception e) {
				return null;
			}
		}
		return null;
	}

}
