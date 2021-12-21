package discrub.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Authorization {
	@JsonProperty("token")
	private String token = "";
	
	private ErrorResponse errorResponse = ErrorResponse.NONE;
	
	public Authorization(){
		
	}
	
	public Authorization(ErrorResponse er) {
		errorResponse = er;
		token = null;
	}
	
	public String getToken() {
		return token;
	}
	public void setToken(String token) {
		this.token = token;
	}
	public ErrorResponse getErrorResponse() {
		return errorResponse;
	}
	public void setErrorResponse(ErrorResponse errorResponse) {
		this.errorResponse = errorResponse;
	}
}
