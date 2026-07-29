<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Injects `window.mpeChatbotContext` into every front-end page — the bridge
 * that lets the same-origin widget know who's logged in without any separate
 * in-chat login step. Optionally also injects the widget's own <script> tags
 * if a widget URL + API URL are configured (Settings > MPE Chatbot), so a site
 * owner can go live with zero manual embed code.
 */
add_action( 'wp_footer', 'mpe_chatbot_inject_context', 100 );

function mpe_chatbot_inject_context() {
	if ( is_admin() ) {
		return;
	}

	if ( is_user_logged_in() ) {
		$context = MPE_Chatbot_Auth::build_widget_context_for_user( wp_get_current_user() );
	} else {
		$current_url = home_url( add_query_arg( null, null ) );
		$context      = array(
			'loggedIn' => false,
			'loginUrl' => wp_login_url( $current_url ),
		);
	}

	echo "\n<script>window.mpeChatbotContext = " . wp_json_encode( $context ) . ";</script>\n";

	$widget_js = get_option( MPE_CHATBOT_OPTION_WIDGET_URL );
	$api_url   = get_option( MPE_CHATBOT_OPTION_API_URL );

	if ( $widget_js && $api_url ) {
		printf(
			"<script src=\"%s\"></script>\n<script>window.MpeChatbot && window.MpeChatbot.init({ apiUrl: %s });</script>\n",
			esc_url( $widget_js ),
			wp_json_encode( $api_url )
		);
	}
}
