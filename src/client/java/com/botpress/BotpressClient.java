package com.botpress;

import com.botpress.chat.ChatInterceptor;
import net.fabricmc.api.ClientModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class BotpressClient implements ClientModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("MineBot");

	@Override
	public void onInitializeClient() {
		ChatInterceptor.register();
		LOGGER.info("MineBot AI initialized! Use !ai <message> in chat.");
	}
}