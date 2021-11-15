package discrub.windows.management;

import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.JTable;
import javax.swing.SwingUtilities;
import javax.swing.table.DefaultTableModel;

import discrub.domain.DiscordAccount;
import discrub.domain.Message;

import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.LayoutStyle.ComponentPlacement;
import java.awt.event.ActionListener;
import java.util.List;
import java.awt.Component;
import java.awt.event.ActionEvent;

@SuppressWarnings("serial")
public class Delete extends JPanel {

	/**
	 * Create the panel.
	 */
	public Delete(Object o, DiscordAccount discordAccount, List<Message> messages) {

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

		JButton btnNewButton = new JButton("Delete");
		btnNewButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				JFrame main = (JFrame) SwingUtilities.getRoot((Component) e.getSource());
				DeleteDialog deleteDialog = new DeleteDialog(main, discordAccount, table.getSelectedRows(), messages, o);
				deleteDialog.setVisible(true);
			}
		});
		GroupLayout groupLayout = new GroupLayout(this);
		groupLayout.setHorizontalGroup(groupLayout.createParallelGroup(Alignment.TRAILING)
				.addGroup(groupLayout.createSequentialGroup()
						.addGroup(groupLayout.createParallelGroup(Alignment.LEADING)
								.addGroup(groupLayout.createSequentialGroup().addGap(181).addComponent(btnNewButton))
								.addComponent(scrollPane, GroupLayout.PREFERRED_SIZE, 253, GroupLayout.PREFERRED_SIZE))
						.addContainerGap(197, Short.MAX_VALUE)));
		groupLayout.setVerticalGroup(groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
						.addComponent(scrollPane, GroupLayout.PREFERRED_SIZE, 115, GroupLayout.PREFERRED_SIZE)
						.addPreferredGap(ComponentPlacement.RELATED).addComponent(btnNewButton)
						.addContainerGap(156, Short.MAX_VALUE)));
		setLayout(groupLayout);

	}
}
