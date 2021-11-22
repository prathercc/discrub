package discrub;

import java.awt.EventQueue;

import javax.swing.JFrame;

import com.formdev.flatlaf.FlatLightLaf;

import discrub.services.FileService;
import discrub.windows.Login;

import java.awt.Font;
import java.awt.Toolkit;

import java.awt.Dimension;

@SuppressWarnings("serial")
public class Main extends JFrame {
	FileService ioService = new FileService();

	/**
	 * Launch the application.
	 */
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {
					FlatLightLaf.setup();
					Main frame = new Main();
					frame.setVisible(true);
					Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();
					frame.setLocation(dim.width/2-frame.getSize().width/2, dim.height/2-frame.getSize().height/2);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}

	/**
	 * Create the frame.
	 */
	public Main() {
		setFont(new Font("DejaVu Math TeX Gyre", Font.PLAIN, 12));
		setTitle("Discrub");
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setBounds(100, 100, 313, 285);
		Login loginMenu = new Login();
		setContentPane(loginMenu);
		setResizable(false);
	}
}
