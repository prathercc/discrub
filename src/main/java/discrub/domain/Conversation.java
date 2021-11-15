package discrub.domain;


import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Conversation {
	
	@JsonProperty("id")
	private String id = "";
	
	@JsonProperty("recipients")
	private List<User> recipients = new ArrayList<User>();
	
	@JsonProperty("type")
	private int type = -1;

	private List<Message> messages = new ArrayList<Message>();
	
	public void setRecipients(List<User> val) {
		recipients = val;
	}
	
	public List<User> getRecipients(){
		return recipients;
	}
	
	public void setId(String val) {
		id = val;
	}
	
	public String getId() {
		return id;
	}
	
	public void setType(int val) {
		type = val;
	}
	
	public int getType() {
		return type;
	}
	
	public List<Message> getMessages(){
		return messages;
	}
	
	public void setMessages(List<Message> val) {
		messages = val;
	}
	
	public String toString() {
		if(getRecipients().size() == 0) {
			return "[Unnamed: " + getId() + "]";
		}
		else if(getType() == 1) {
			return getRecipients().get(0).getUsername();
		}
		else if(getType() == 3) {
			return "[Group Conversation: " + getId() + "]";
		}
		else {
			return "[ERROR PARSING NAME]";
		}
	}
}