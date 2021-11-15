package discrub.services;


import java.io.IOException;
import java.nio.file.Files;
import java.util.stream.Stream;

import discrub.utilities.Properties;

public class FileService {

	AccountService accountService;

	public FileService() {
		
	}

	public String getIniValue() {
		StringBuilder builder = new StringBuilder();
		try {
			Stream<String> fileStream = Files.lines(Properties.iniPath);
			fileStream.forEach(s -> builder.append(s));
			fileStream.close();
		} catch (Exception e) {
		}
		return builder.toString();
	}

	public void setIniValue(String val) {
		try {
			Files.write(Properties.iniPath, val.getBytes());
		} catch (IOException e) {
		}
	}

	public void checkIniFolderPath() {
		try {
			if (!Files.exists(Properties.iniFolderPath)) {
				Files.createDirectory(Properties.iniFolderPath);
			}
			if (!Files.exists(Properties.iniPath)) {
				Files.createFile(Properties.iniPath);
			}
		} catch (Exception e) {
		}
	}
}