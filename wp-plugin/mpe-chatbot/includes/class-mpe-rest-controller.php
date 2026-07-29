<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Base class for customer-scoped REST controllers. `authenticate()` is the
 * permission_callback shared by every route except /refresh-token: it verifies
 * the HMAC bearer token independently of WP's cookie/nonce auth (the request
 * is coming server-to-server from Express, not the visitor's browser) and
 * resolves it to a real WP user before the route callback ever runs.
 */
abstract class MPE_Chatbot_REST_Controller {

	public static function authenticate( WP_REST_Request $request ) {
		$token = MPE_Chatbot_Auth::get_bearer_token( $request );
		if ( ! $token ) {
			return new WP_Error( 'mpe_chatbot_missing_token', 'Missing Authorization bearer token', array( 'status' => 401 ) );
		}

		$payload = MPE_Chatbot_Auth::verify_token( $token );
		if ( is_wp_error( $payload ) ) {
			return new WP_Error( 'mpe_chatbot_unauthorized', $payload->get_error_message(), array( 'status' => 401 ) );
		}

		$user_id = isset( $payload['uid'] ) ? (int) $payload['uid'] : 0;
		$user    = $user_id ? get_user_by( 'id', $user_id ) : false;
		if ( ! $user ) {
			return new WP_Error( 'mpe_chatbot_unknown_user', 'Token does not match a known user', array( 'status' => 403 ) );
		}

		$request->set_param( '_mpe_user_id', $user_id );
		return true;
	}

	protected static function get_authenticated_user_id( WP_REST_Request $request ) {
		return (int) $request->get_param( '_mpe_user_id' );
	}
}
