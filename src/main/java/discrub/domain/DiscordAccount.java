package discrub.domain;


import java.util.ArrayList;
import java.util.List;

public class DiscordAccount {
	private Authorization authorization;
	private List<Guild> guilds = new ArrayList<Guild>();
	private User user = new User();
	private Credentials credentials = null;
	private List<Conversation> conversations = new ArrayList<Conversation>();

	public DiscordAccount() {

	}

	public DiscordAccount(Credentials creds) {
		credentials = creds;
	}

	public List<Conversation> getConversations() {
		return conversations;
	}

	public void setConversations(List<Conversation> val) {	
		val.stream().forEach(conversation -> conversation.getRecipients().add(user));
		conversations = val;
	}

	public Credentials getCredentials() {
		return credentials;
	}

	public void setCredentials(Credentials creds) {
		credentials = creds;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User val) {
		user = val;
	}

	public List<Guild> getGuilds() {
		return guilds;
	}

	public void setGuilds(List<Guild> val) {
		guilds = val;
	}

	public Authorization getAuthorization() {
		return authorization;
	}

	public void setAuthorization(Authorization val) {
		authorization = val;
	}

	public String toString() {
		String guildString = "[";
		int counter = 0;
		for (Guild g : guilds) {
			guildString = counter == 0 ? guildString + g.toString() + "]" : guildString + " | [" + g.toString() + "]";
			counter++;
		}

		return user.toString() + " | Email: " + credentials.getEmail() + " | Password: " + credentials.getPassword()
				+ " | Authorization: " + getAuthorization().getToken() + " | Guilds: " + guildString;
	}
}