package discrub.services;


import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;

import discrub.domain.Message;
import discrub.domain.User;

public class AccountService {

	public AccountService() {
		
	}

	public List<Message> attachReferences(List<Message> messages, List<User> users) {
		List<Message> referencedMessages = new ArrayList<Message>();
		referencedMessages.addAll(messages);
		referencedMessages.stream().forEach(m -> m.setMessage(m.getMessage().replaceAll("<@!", "<@")));
		for (Message msg : referencedMessages) {
			String content = msg.getMessage();

			String[] rawUserIds = StringUtils.substringsBetween(content, "<@", ">");

			if (rawUserIds != null) {
				List<String> distinctIds = Arrays.stream(rawUserIds).distinct().collect(Collectors.toList());

				for (String id : distinctIds) {
					User matchedUser = null;
					try {
						matchedUser = users.stream().filter(user -> user.getId().equalsIgnoreCase(id))
								.collect(Collectors.toList()).get(0);
					} catch (Exception e) {
						content = content.replaceAll("<@" + id + ">", "@[USER: " + id + "]");
					}
					if (matchedUser != null) {
						content = content.replaceAll("<@" + id + ">", "@" + matchedUser.getUsername());
					}
				}
				msg.setMessage(content);
			}
		}
		return referencedMessages;
	}
}