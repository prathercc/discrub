package discrub.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Attachment {
	@JsonProperty("filename")
	private String filename = "";

	@JsonProperty("id")
	private String id = "";

	@JsonProperty("url")
	private String url = "";

	public void setUrl(String val) {
		url = val;
	}

	public String getUrl() {
		return url;
	}

	public void setId(String val) {
		id = val;
	}

	public String getId() {
		return id;
	}

	public void setFilename(String val) {
		filename = val;
	}

	public String getFilename() {
		return filename;
	}
}