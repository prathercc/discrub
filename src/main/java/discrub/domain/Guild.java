package discrub.domain;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Guild {
	@JsonProperty("id")
	private String id = "";

	@JsonProperty("name")
	private String name = "";

	@JsonProperty("owner")
	private boolean isOwner = false;

	private List<Channel> channels = new ArrayList<Channel>();

	public List<Channel> getChannels() {
		return channels;
	}

	public void setChannels(List<Channel> val) {
		val.stream().filter(channel -> channel.getType() == 0).forEach(channel -> channels.add(channel));
		channels.stream().forEach(channel -> channel.setGuildName(name));
	}

	public String getId() {
		return id;
	}

	public void setId(String val) {
		id = val;
	}

	public String getName() {
		return name;
	}

	public void setName(String val) {
		name = val;
	}

	public boolean getIsOwner() {
		return isOwner;
	}

	public void setIsOwner(boolean val) {
		isOwner = val;
	}

	public String toString() {
		return getName();
	}

}