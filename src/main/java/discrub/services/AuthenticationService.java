package discrub.services;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
//import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;

import discrub.domain.Authorization;
import discrub.domain.Channel;
import discrub.domain.Conversation;
import discrub.domain.Credentials;
import discrub.domain.DiscordAccount;
import discrub.domain.ErrorResponse;
import discrub.domain.Guild;
import discrub.domain.User;
import discrub.utilities.Properties;

public class AuthenticationService {

	public Authorization fetchAuthorization(Credentials credentials) {
		try {
			RestTemplate restTemplate = new RestTemplate();
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<Credentials> request = new HttpEntity<Credentials>(credentials, headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<Authorization> response = restTemplate.exchange(Properties.discordAuthUrl + "/login",
					HttpMethod.POST, request, Authorization.class);
			return response.getStatusCodeValue() == 200 ? response.getBody() : null;
		} catch (Exception e) {
			if (e.getMessage().contains("captcha-required")) {
				return new Authorization(ErrorResponse.CAPTCHA_REQURED);
			} else if (e.getMessage().contains("Login or password is invalid")) {
				return new Authorization(ErrorResponse.INVALID_PASSWORD);
			} else {
				return new Authorization(ErrorResponse.UNKNOWN);
			}
		}
	}

	public User fetchUserData(DiscordAccount discordAccount) {
		try {
			RestTemplate restTemplate = new RestTemplate();
			HttpHeaders headers = new HttpHeaders();
			headers.set("authorization", discordAccount.getAuthorization().getToken());
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<JsonNode> request = new HttpEntity<JsonNode>(headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<User> response = restTemplate.exchange(Properties.discordUsersUrl + "/@me", HttpMethod.GET,
					request, User.class);
			return response.getBody();
		} catch (Exception e) {
			return null;
		}
	}

	public List<Conversation> fetchConversations(DiscordAccount discordAccount) {
		try {
			RestTemplate restTemplate = new RestTemplate();
			HttpHeaders headers = new HttpHeaders();
			headers.set("authorization", discordAccount.getAuthorization().getToken());
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<JsonNode> request = new HttpEntity<JsonNode>(headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<Conversation[]> response = restTemplate.exchange(
					Properties.discordUsersUrl + "/@me/channels", HttpMethod.GET, request, Conversation[].class);
			return Arrays.stream(response.getBody()).collect(Collectors.toList());
		} catch (Exception e) {
			return null;
		}
	}

	public List<Channel> fetchChannels(Guild guild, DiscordAccount discordAccount) {
		try {
			RestTemplate restTemplate = new RestTemplate();
			HttpHeaders headers = new HttpHeaders();
			headers.set("authorization", discordAccount.getAuthorization().getToken());
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<JsonNode> request = new HttpEntity<JsonNode>(headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<Channel[]> response = restTemplate.exchange(
					Properties.discordGuildsUrl + "/" + guild.getId() + "/channels", HttpMethod.GET, request,
					Channel[].class);
			return Arrays.stream(response.getBody()).collect(Collectors.toList());
		} catch (Exception e) {
			return null;
		}
	}

	public List<Guild> fetchGuilds(DiscordAccount discordAccount) {
		try {
			RestTemplate restTemplate = new RestTemplate();
			HttpHeaders headers = new HttpHeaders();
			headers.set("authorization", discordAccount.getAuthorization().getToken());
			headers.set("user-agent", Properties.userAgent);
			HttpEntity<JsonNode> request = new HttpEntity<JsonNode>(headers);
			restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
			ResponseEntity<Guild[]> response = restTemplate.exchange(Properties.discordUsersUrl + "/@me/guilds",
					HttpMethod.GET, request, Guild[].class);
			return Arrays.stream(response.getBody()).collect(Collectors.toList());
		} catch (Exception e) {
			return null;
		}
	}
}
