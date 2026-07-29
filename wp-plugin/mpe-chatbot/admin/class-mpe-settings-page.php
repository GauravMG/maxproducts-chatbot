<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'admin_menu',
	function () {
		add_options_page(
			'MPE Chatbot',
			'MPE Chatbot',
			'manage_options',
			'mpe-chatbot',
			'mpe_chatbot_render_settings_page'
		);
	}
);

add_action(
	'admin_init',
	function () {
		register_setting( 'mpe_chatbot', MPE_CHATBOT_OPTION_SECRET );
		register_setting( 'mpe_chatbot', MPE_CHATBOT_OPTION_WIDGET_URL );
		register_setting( 'mpe_chatbot', MPE_CHATBOT_OPTION_API_URL );
		register_setting(
			'mpe_chatbot',
			MPE_CHATBOT_OPTION_TOKEN_TTL,
			array(
				'sanitize_callback' => function ( $value ) {
					return max( 60, min( 3600, (int) $value ) );
				},
			)
		);
	}
);

function mpe_chatbot_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1>MPE Chatbot Connector</h1>
		<p>
			Configures the connection between this site and the chatbot's Express backend.
			The <strong>Shared secret</strong> below must match the <code>WP_SHARED_SECRET</code>
			environment variable on the chatbot server <em>exactly</em> &mdash; it's what lets both
			sides verify each other's signed identity tokens without any other shared state or
			database lookups.
		</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'mpe_chatbot' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="mpe_chatbot_secret">Shared secret</label></th>
					<td>
						<input type="text" id="mpe_chatbot_secret" name="<?php echo esc_attr( MPE_CHATBOT_OPTION_SECRET ); ?>"
							value="<?php echo esc_attr( get_option( MPE_CHATBOT_OPTION_SECRET ) ); ?>" class="regular-text code" />
						<p class="description">Copy this exact value into the chatbot server's <code>WP_SHARED_SECRET</code>.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="mpe_chatbot_api_url">Chatbot API URL</label></th>
					<td>
						<input type="url" id="mpe_chatbot_api_url" name="<?php echo esc_attr( MPE_CHATBOT_OPTION_API_URL ); ?>"
							value="<?php echo esc_attr( get_option( MPE_CHATBOT_OPTION_API_URL ) ); ?>" class="regular-text"
							placeholder="https://chatbot-api.example.com" />
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="mpe_chatbot_widget_url">Widget script URL</label></th>
					<td>
						<input type="url" id="mpe_chatbot_widget_url" name="<?php echo esc_attr( MPE_CHATBOT_OPTION_WIDGET_URL ); ?>"
							value="<?php echo esc_attr( get_option( MPE_CHATBOT_OPTION_WIDGET_URL ) ); ?>" class="regular-text"
							placeholder="https://chatbot-cdn.example.com/mpe-chatbot-widget.js" />
						<p class="description">
							Leave both URL fields blank to have this plugin inject only the identity context
							(<code>window.mpeChatbotContext</code>) and embed the widget script yourself instead,
							e.g. via Divi's Theme Options &rarr; Integration &rarr; footer code.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="mpe_chatbot_ttl">Token TTL (seconds)</label></th>
					<td>
						<input type="number" id="mpe_chatbot_ttl" name="<?php echo esc_attr( MPE_CHATBOT_OPTION_TOKEN_TTL ); ?>"
							value="<?php echo esc_attr( get_option( MPE_CHATBOT_OPTION_TOKEN_TTL, 900 ) ); ?>" class="small-text" min="60" max="3600" />
						<p class="description">Must match <code>TOKEN_TTL_SECONDS</code> on the chatbot server. Default 900 (15 minutes).</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}
