package discrub.windows;

import java.awt.Color;
import java.awt.Component;
import java.awt.Desktop;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.net.URI;
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
import discrub.domain.ErrorResponse;
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
		rememberMeCheckBox.setFont(new Font("Tahoma", Font.BOLD, 11));
		JTextField emailTextField = new JTextField();
		emailTextField.setColumns(10);
		JLabel lblNewLabel_1 = new JLabel("Password:");
		lblNewLabel_1.setFont(new Font("Tahoma", Font.BOLD, 11));
		JLabel lblNewLabel = new JLabel("Email:");
		lblNewLabel.setFont(new Font("Tahoma", Font.BOLD, 11));
		passwordTextField = new JPasswordField();
		JButton emailSignInButton = new JButton("Sign-In");
		emailSignInButton.setEnabled(passwordTextField.getText().length() > 0 ? true : false);
		JLabel networkErrorText = new JLabel("Network Error Detected");
		networkErrorText.setForeground(Color.RED);
		networkErrorText.setVisible(false);

		// Checking if Remember Me checkbox is checked
		ioService.checkIniFolderPath();
		String iniValue = ioService.getIniValue();
		if (iniValue.length() != 0) {
			rememberMeCheckBox.setSelected(true);
			emailTextField.setText(iniValue);
		}

		this.setBorder(new EmptyBorder(5, 5, 5, 5));

		GroupLayout gl_loginMenu = new GroupLayout(this);
		gl_loginMenu.setHorizontalGroup(gl_loginMenu.createParallelGroup(Alignment.LEADING)
				.addGroup(gl_loginMenu.createSequentialGroup().addContainerGap().addGroup(gl_loginMenu
						.createParallelGroup(Alignment.LEADING).addComponent(lblNewLabel).addComponent(lblNewLabel_1)
						.addGroup(gl_loginMenu.createParallelGroup(Alignment.LEADING, false)
								.addComponent(passwordTextField)
								.addGroup(gl_loginMenu.createSequentialGroup().addComponent(rememberMeCheckBox)
										.addPreferredGap(ComponentPlacement.RELATED, GroupLayout.DEFAULT_SIZE,
												Short.MAX_VALUE)
										.addComponent(emailSignInButton))
								.addComponent(emailTextField, GroupLayout.PREFERRED_SIZE, 200,
										GroupLayout.PREFERRED_SIZE)
								.addComponent(networkErrorText, Alignment.TRAILING)))
						.addContainerGap(28, Short.MAX_VALUE)));
		gl_loginMenu
				.setVerticalGroup(
						gl_loginMenu.createParallelGroup(Alignment.LEADING)
								.addGroup(gl_loginMenu.createSequentialGroup().addComponent(lblNewLabel)
										.addPreferredGap(ComponentPlacement.RELATED)
										.addComponent(emailTextField, GroupLayout.PREFERRED_SIZE,
												GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
										.addGap(2).addComponent(lblNewLabel_1)
										.addPreferredGap(ComponentPlacement.RELATED)
										.addComponent(passwordTextField, GroupLayout.PREFERRED_SIZE,
												GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
										.addPreferredGap(ComponentPlacement.UNRELATED)
										.addGroup(gl_loginMenu.createParallelGroup(Alignment.BASELINE)
												.addComponent(rememberMeCheckBox).addComponent(emailSignInButton))
										.addPreferredGap(ComponentPlacement.RELATED, 8, Short.MAX_VALUE)
										.addComponent(networkErrorText)));
		this.setLayout(gl_loginMenu);

		emailTextField.addKeyListener(new KeyAdapter() {
			@Override
			public void keyTyped(KeyEvent e) {
				if (passwordTextField.getPassword().length >= 1 && emailTextField.getText().length() >= 1) {
					emailSignInButton.setEnabled(true);
				} else {
					emailSignInButton.setEnabled(false);
				}
			}
		});
		passwordTextField.addKeyListener(new KeyAdapter() {
			@Override
			public void keyTyped(KeyEvent e) {
				if (passwordTextField.getPassword().length >= 1 && emailTextField.getText().length() >= 1) {
					emailSignInButton.setEnabled(true);
				} else {
					emailSignInButton.setEnabled(false);
				}
				if (e.getKeyChar() == KeyEvent.VK_ENTER && emailSignInButton.isEnabled()) {
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
						Credentials credentials = new Credentials(emailTextField.getText(),
								passwordTextField.getText());
						DiscordAccount discordAccount = createDiscordAccount(credentials);
						if (discordAccount != null
								&& discordAccount.getAuthorization().getErrorResponse() == ErrorResponse.NONE) {
							ioService.setIniValue(emailTextField.getText());
							Configuration configuration = new Configuration(discordAccount);
							main.setContentPane(configuration);
							main.revalidate();
							main.repaint();
						} else {
							ErrorResponse er = discordAccount.getAuthorization().getErrorResponse();
							switch (er) {
							case INVALID_PASSWORD:
								networkErrorText.setText("Invalid Password");
								break;
							case CAPTCHA_REQURED:
								try {
									Desktop.getDesktop().browse(new URI("https://discord.com/login"));
								} catch (Exception e) {
								}
								networkErrorText.setText("CAPTCHA Required");
								break;
							default:
								networkErrorText.setText("Network Error Detected");
								break;
							}
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
		discordAccount.setAuthorization(authorization);
		switch (authorization.getErrorResponse()) {
		case CAPTCHA_REQURED:
			return discordAccount;
		case INVALID_PASSWORD:
			return discordAccount;
		case UNKNOWN:
			return discordAccount;
		default:
			try {
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
	}

}
