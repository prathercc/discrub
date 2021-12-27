package discrub.services;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPatch;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.message.BasicHeader;
import org.apache.http.protocol.HTTP;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;

import discrub.domain.Channel;
import discrub.domain.Conversation;
import discrub.domain.DiscordAccount;
import discrub.domain.Message;
import discrub.utilities.Properties;

public class MessageService {

	AccountService accountService;

	public MessageService() {
	}
	
	public boolean editMessage(Message msg, String newMessageContent, String channelId, DiscordAccount discordAccount) {
		//Unfortunately I cannot use PATCH with RestTemplate, so we have to use Apache's HttpClient to make this request.
		newMessageContent = newMessageContent.length() >= 2000 ? newMessageContent.substring(0, 1999) : newMessageContent;
		String sessionAuthorization = discordAccount.getAuthorization().getToken();
		try {
			String requestUrl = Properties.discordChannelsUrl + "/" + channelId
					+ "/messages/" + msg.getId();
			HttpClient httpclient = HttpClients.createDefault();
		    HttpPatch httpPatch = new HttpPatch(requestUrl);
		    httpPatch.setHeader("authorization", sessionAuthorization);
		    httpPatch.setHeader("user-agent", Properties.userAgent);
		    StringEntity params =new StringEntity("{\"content\": \"" + newMessageContent + "\"}");
		    params.setContentType(new BasicHeader(HTTP.CONTENT_TYPE, "application/json"));
		    httpPatch.setEntity(params);
		    HttpResponse response = httpclient.execute(httpPatch);
		    return response.getStatusLine().getStatusCode() == 200;
		}
		catch(Exception e) {
			return false;
		}
	}
	
	public boolean deleteMessage(Message msg, String channelId, DiscordAccount discordAccount) {
		String sessionAuthorization = discordAccount.getAuthorization().getToken();
		try {
			RestTemplate restTemplate = new RestTemplate();
			String requestUrl = Properties.discordChannelsUrl + "/" + channelId
					+ "/messages/" + msg.getId();
			HttpHeaders headers = new HttpHeaders();
			headers.set("authorization", sessionAuthorization);
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<JsonNode> request = new HttpEntity<JsonNode>(headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<String> response = restTemplate.exchange(requestUrl, HttpMethod.DELETE, request, String.class);
			return response.getStatusCodeValue() == 204;
		}
		catch(Exception e) {
			return false;
		}
	}

	public List<Message> fetchConversationMessages(String lastId, Conversation conversation, DiscordAccount discordAccount) {
		String conversationId = conversation.getId();
		String sessionAuthorization = discordAccount.getAuthorization().getToken();
		try {
			RestTemplate restTemplate = new RestTemplate();
			String requestUrl = lastId.length() < 1
					? Properties.discordChannelsUrl + "/" + conversationId + "/messages?limit=100"
					: Properties.discordChannelsUrl + "/" + conversationId + "/messages?limit=100&before=" + lastId;
			HttpHeaders headers = new HttpHeaders();
			headers.set("authorization", sessionAuthorization);
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<JsonNode> request = new HttpEntity<JsonNode>(headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<Message[]> response = restTemplate.exchange(requestUrl, HttpMethod.GET, request,
					Message[].class);
			return Arrays.stream(response.getBody()).collect(Collectors.toList());
		}
		catch(Exception e) {
			return new ArrayList<Message>();
		}
	}

	public List<Message> fetchChannelMessages(String lastId, Channel channel, DiscordAccount discordAccount) {
		String channelId = channel.getId();
		String sessionAuthorization = discordAccount.getAuthorization().getToken();
		try {
			RestTemplate restTemplate = new RestTemplate();
			String requestUrl = lastId.length() < 1
					? Properties.discordChannelsUrl + "/" + channelId + "/messages?limit=100"
					: Properties.discordChannelsUrl + "/" + channelId + "/messages?limit=100&before=" + lastId;
			HttpHeaders headers = new HttpHeaders();
			headers.set("authorization", sessionAuthorization);
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<JsonNode> request = new HttpEntity<JsonNode>(headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<Message[]> response = restTemplate.exchange(requestUrl, HttpMethod.GET, request,
					Message[].class);
			return Arrays.stream(response.getBody()).collect(Collectors.toList());
		}
		catch(Exception e) {
			return new ArrayList<Message>();
		}
	}
}