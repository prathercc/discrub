package discrub.domain;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

//import javafx.beans.property.BooleanProperty;
//import javafx.beans.property.SimpleBooleanProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class User {
	@JsonProperty("id")
	private String id = "";

	@JsonProperty("username")
	private String username = "";

	@JsonProperty("discriminator")
	private String discriminator = "";
	
	@JsonProperty("email")
	private String email = "";

//	private BooleanProperty isSelected = new SimpleBooleanProperty();
//
//	public final BooleanProperty getIsSelected() {
//		return isSelected;
//	}
//
//	public final void setIsSelected(final boolean val) {
//		getIsSelected().set(val);
//	}

	public String toString() {
		return getUsername();
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getDiscriminator() {
		return discriminator;
	}

	public void setDiscriminator(String discriminator) {
		this.discriminator = discriminator;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}
}