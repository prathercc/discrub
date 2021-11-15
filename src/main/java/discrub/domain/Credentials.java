package discrub.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Credentials {
	@JsonProperty("email")
	private String email = "";
	
	@JsonProperty("password")
	private String password = "";

	public String getEmail() {
		return email;
	}

	public void setEmail(String val) {
		email = val;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String val) {
		password = val;
	}
	
	public Credentials(String mail, String pass) {
		email = mail;
		password = pass;
	}
}