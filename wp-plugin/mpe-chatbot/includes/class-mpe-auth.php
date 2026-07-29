<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Short-lived HMAC-signed token issuance/verification. Deliberately mirrors
 * apps/server/src/auth/token.ts field-for-field (base64url(JSON payload) + "."
 * + hex HMAC-SHA256 signature) so tokens minted here are verifiable statelessly
 * by the Express backend, and vice versa, with no other shared state.
 */
class MPE_Chatbot_Auth {

	public static function get_secret() {
		return (string) get_option( MPE_CHATBOT_OPTION_SECRET, '' );
	}

	public static function get_ttl() {
		return (int) get_option( MPE_CHATBOT_OPTION_TOKEN_TTL, 900 );
	}

	private static function base64url_encode( $data ) {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}

	private static function base64url_decode( $data ) {
		$padded = strtr( $data, '-_', '+/' );
		$pad    = strlen( $padded ) % 4;
		if ( $pad ) {
			$padded .= str_repeat( '=', 4 - $pad );
		}
		return base64_decode( $padded );
	}

	/**
	 * @param array    $data       Arbitrary claims, e.g. ['uid' => 1, 'email' => ..., 'name' => ...].
	 * @param int|null $ttl_seconds Overrides the configured default TTL.
	 * @return string|WP_Error
	 */
	public static function issue_token( array $data, $ttl_seconds = null ) {
		$secret = self::get_secret();
		if ( empty( $secret ) ) {
			return new WP_Error( 'mpe_chatbot_no_secret', 'MPE Chatbot shared secret is not configured (Settings > MPE Chatbot).' );
		}

		$ttl     = $ttl_seconds ? (int) $ttl_seconds : self::get_ttl();
		$now     = time();
		$payload = array_merge(
			$data,
			array(
				'iat' => $now,
				'exp' => $now + $ttl,
			)
		);

		$segment   = self::base64url_encode( wp_json_encode( $payload ) );
		$signature = hash_hmac( 'sha256', $segment, $secret );

		return $segment . '.' . $signature;
	}

	/**
	 * @param string $token
	 * @return array|WP_Error Decoded payload on success.
	 */
	public static function verify_token( $token ) {
		$secret = self::get_secret();
		if ( empty( $secret ) || empty( $token ) ) {
			return new WP_Error( 'mpe_chatbot_invalid_token', 'Missing token or shared secret' );
		}

		$parts = explode( '.', $token );
		if ( count( $parts ) !== 2 ) {
			return new WP_Error( 'mpe_chatbot_malformed_token', 'Malformed token' );
		}
		list( $segment, $signature ) = $parts;

		$expected = hash_hmac( 'sha256', $segment, $secret );
		if ( ! hash_equals( $expected, $signature ) ) {
			return new WP_Error( 'mpe_chatbot_bad_signature', 'Invalid token signature' );
		}

		$payload = json_decode( self::base64url_decode( $segment ), true );
		if ( ! is_array( $payload ) || ! isset( $payload['exp'] ) ) {
			return new WP_Error( 'mpe_chatbot_malformed_payload', 'Malformed token payload' );
		}

		if ( (int) $payload['exp'] < time() ) {
			return new WP_Error( 'mpe_chatbot_expired_token', 'Token expired' );
		}

		return $payload;
	}

	/**
	 * Reads the bearer token from a REST request's Authorization header.
	 *
	 * @return string|null
	 */
	public static function get_bearer_token( WP_REST_Request $request ) {
		$header = $request->get_header( 'authorization' );
		if ( ! $header || stripos( $header, 'Bearer ' ) !== 0 ) {
			return null;
		}
		return trim( substr( $header, 7 ) );
	}

	/**
	 * Builds the full widget identity context for the current request/user —
	 * shared by the wp_footer injector and the /refresh-token endpoint.
	 */
	public static function build_widget_context_for_user( WP_User $user ) {
		$token = self::issue_token(
			array(
				'uid'   => $user->ID,
				'email' => $user->user_email,
				'name'  => $user->display_name,
			)
		);

		if ( is_wp_error( $token ) ) {
			return array( 'loggedIn' => false );
		}

		return array(
			'loggedIn'   => true,
			'token'      => $token,
			'expiresAt'  => ( time() + self::get_ttl() ) * 1000,
			'restBase'   => rest_url( MPE_CHATBOT_REST_NAMESPACE ),
			'refreshUrl' => rest_url( MPE_CHATBOT_REST_NAMESPACE . '/refresh-token' ),
		);
	}
}
