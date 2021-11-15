package discrub.domain;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;


@JsonIgnoreProperties(ignoreUnknown = true)
public class Message {

	@JsonProperty("author")
	private Author author = new Author();

	@JsonProperty("id")
	private String id = "";

	@JsonProperty("content")
	private String message = "";

	@JsonProperty("channel_id")
	private String channelId = "";

	@JsonProperty("timestamp")
	private String datePosted = "";

	@JsonProperty("attachments")
	private List<Attachment> attachments = new ArrayList<Attachment>();


	public void setEmbeddedObjects(List<Attachment> val) {
		attachments = val;
	}

	public List<Attachment> getEmbeddedObjects() {
		return attachments;
	}

	public Author getAuthor() {
		return author;
	}

	public void setAuthor(Author val) {
		author = val;
	}

	public String getDatePosted() {
		TimeZone tz = Calendar.getInstance().getTimeZone();
		String date = OffsetDateTime.parse(datePosted)
				.format(DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm").withZone(tz.toZoneId()));
		return date;
	}

	public void setDatePosted(String val) {
		datePosted = val;
	}

	public String getChannelId() {
		return channelId;
	}

	public void setChannelId(String val) {
		channelId = val;
	}

	public String getMessage() {
		return message.replaceAll("[^\\x00-\\x7F]", "");
	}

	public void setMessage(String val) {
		message = val;
	}

	public String getId() {
		return id;
	}

	public void setId(String val) {
		id = val;
	}

	public String toString() {
		String attachmentString = attachments.size() == 1 ? " " + attachments.get(0).getUrl() : "";
		return "[" + getDatePosted() + "] " + getMessage() + attachmentString;
	}
}