<?php
/**
 * Plugin Name: MPE Chatbot Connector
 * Description: Companion plugin for the Max Power Europe AI chatbot. Issues short-lived signed
 *              identity tokens to logged-in visitors and exposes customer-scoped REST endpoints
 *              (account, addresses, orders, invoices) that the chatbot's Express backend calls on
 *              their behalf. See wp-plugin/mpe-chatbot/README.md in the chatbot repo for the full
 *              design (the HMAC token scheme mirrors apps/server/src/auth/token.ts exactly).
 * Version:     0.1.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Text Domain: mpe-chatbot
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MPE_CHATBOT_VERSION', '0.1.0' );
define( 'MPE_CHATBOT_REST_NAMESPACE', 'mpe-chatbot/v1' );
define( 'MPE_CHATBOT_OPTION_SECRET', 'mpe_chatbot_shared_secret' );
define( 'MPE_CHATBOT_OPTION_WIDGET_URL', 'mpe_chatbot_widget_js_url' );
define( 'MPE_CHATBOT_OPTION_API_URL', 'mpe_chatbot_api_url' );
define( 'MPE_CHATBOT_OPTION_TOKEN_TTL', 'mpe_chatbot_token_ttl' );
define( 'MPE_CHATBOT_DIR', plugin_dir_path( __FILE__ ) );

require_once MPE_CHATBOT_DIR . 'includes/class-mpe-auth.php';
require_once MPE_CHATBOT_DIR . 'includes/class-mpe-rest-controller.php';
require_once MPE_CHATBOT_DIR . 'includes/class-mpe-account.php';
require_once MPE_CHATBOT_DIR . 'includes/class-mpe-orders.php';
require_once MPE_CHATBOT_DIR . 'includes/class-mpe-invoice.php';
require_once MPE_CHATBOT_DIR . 'includes/class-mpe-context-injector.php';
require_once MPE_CHATBOT_DIR . 'admin/class-mpe-settings-page.php';

register_activation_hook( __FILE__, 'mpe_chatbot_on_activate' );

function mpe_chatbot_on_activate() {
	if ( ! get_option( MPE_CHATBOT_OPTION_SECRET ) ) {
		// A sane one-time default so the plugin isn't broken out of the box; the admin
		// should still copy this into the chatbot server's WP_SHARED_SECRET env var
		// (or generate a new one on the settings page) before going live.
		update_option( MPE_CHATBOT_OPTION_SECRET, wp_generate_password( 48, false ) );
	}
	if ( ! get_option( MPE_CHATBOT_OPTION_TOKEN_TTL ) ) {
		update_option( MPE_CHATBOT_OPTION_TOKEN_TTL, 900 );
	}
}

add_action(
	'plugins_loaded',
	function () {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action(
				'admin_notices',
				function () {
					echo '<div class="notice notice-error"><p>MPE Chatbot Connector requires WooCommerce to be installed and active.</p></div>';
				}
			);
		}
	}
);

// REST routes must be registered on rest_api_init (not plugins_loaded) — that's
// the hook WordPress fires once the REST server singleton is ready for plugins
// to add their own routes to it.
add_action(
	'rest_api_init',
	function () {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		MPE_Chatbot_Account_Controller::register();
		MPE_Chatbot_Orders_Controller::register();
	}
);
