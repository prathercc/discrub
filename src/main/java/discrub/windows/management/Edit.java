package discrub.windows.management;

import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.List;

import javax.swing.GroupLayout;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.GroupLayout.Alignment;
import javax.swing.LayoutStyle.ComponentPlacement;
import javax.swing.table.DefaultTableModel;

import discrub.domain.DiscordAccount;
import discrub.domain.Message;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;

@SuppressWarnings("serial")
public class Edit extends JPanel {
	private JTextField textField;

	/**
	 * Create the panel.
	 */
	public Edit(Object o, DiscordAccount discordAccount, List<Message> messages) {
		JTable table = new JTable();
		JScrollPane scrollPane = new JScrollPane(table);
		scrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
		scrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);
		DefaultTableModel tableModel = new DefaultTableModel();
		tableModel.addColumn("Message");
		table.setModel(tableModel);

		for (Message message : messages) {
			tableModel.insertRow(0, new Object[] { message.toString() });
		}

		JButton btnNewButton = new JButton("Edit");
		btnNewButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
				EditDialog editDialog = new EditDialog(main, discordAccount, table.getSelectedRows(), messages, o, textField.getText());
				editDialog.setVisible(true);
			}
		});
		
		textField = new JTextField();
		textField.setToolTipText("New message text");
		textField.setColumns(10);
		GroupLayout groupLayout = new GroupLayout(this);
		groupLayout.setHorizontalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addGroup(groupLayout.createParallelGroup(Alignment.TRAILING, false)
						.addGroup(groupLayout.createSequentialGroup()
							.addContainerGap()
							.addComponent(textField)
							.addGap(18)
							.addComponent(btnNewButton))
						.addComponent(scrollPane, Alignment.LEADING, GroupLayout.PREFERRED_SIZE, 278, GroupLayout.PREFERRED_SIZE))
					.addContainerGap(70, Short.MAX_VALUE))
		);
		groupLayout.setVerticalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addComponent(scrollPane, GroupLayout.PREFERRED_SIZE, 115, GroupLayout.PREFERRED_SIZE)
					.addPreferredGap(ComponentPlacement.RELATED)
					.addGroup(groupLayout.createParallelGroup(Alignment.BASELINE)
						.addComponent(textField, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
						.addComponent(btnNewButton))
					.addContainerGap(34, Short.MAX_VALUE))
		);
		setLayout(groupLayout);
	}
}
