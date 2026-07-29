<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * /me, /account, /addresses, /addresses/{type}, /refresh-token — all scoped to
 * whichever user the request's token (or, for /refresh-token, the browser's own
 * WP session) resolves to. Never accepts a client-supplied user id.
 */
class MPE_Chatbot_Account_Controller extends MPE_Chatbot_REST_Controller {

	public static function register() {
		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/me',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_me' ),
				'permission_callback' => array( __CLASS__, 'authenticate' ),
			)
		);

		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/account',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_account' ),
					'permission_callback' => array( __CLASS__, 'authenticate' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'update_account' ),
					'permission_callback' => array( __CLASS__, 'authenticate' ),
				),
			)
		);

		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/addresses',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_addresses' ),
				'permission_callback' => array( __CLASS__, 'authenticate' ),
			)
		);

		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/addresses/(?P<type>billing|shipping)',
			array(
				'methods'             => 'PUT',
				'callback'            => array( __CLASS__, 'update_address' ),
				'permission_callback' => array( __CLASS__, 'authenticate' ),
			)
		);

		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/refresh-token',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'refresh_token' ),
				'permission_callback' => function () {
					// Same-origin browser -> WP call: WP's core cookie+nonce auth already
					// validated the request before this runs; we only need to confirm login.
					return is_user_logged_in();
				},
			)
		);
	}

	public static function get_me( WP_REST_Request $request ) {
		$user = get_userdata( self::get_authenticated_user_id( $request ) );
		return array(
			'uid'   => $user->ID,
			'email' => $user->user_email,
			'name'  => $user->display_name,
		);
	}

	public static function get_account( WP_REST_Request $request ) {
		$customer = new WC_Customer( self::get_authenticated_user_id( $request ) );
		return array(
			'firstName' => $customer->get_first_name(),
			'lastName'  => $customer->get_last_name(),
			'email'     => $customer->get_email(),
			'phone'     => $customer->get_billing_phone(),
		);
	}

	public static function update_account( WP_REST_Request $request ) {
		$customer = new WC_Customer( self::get_authenticated_user_id( $request ) );
		$body     = (array) $request->get_json_params();

		if ( isset( $body['firstName'] ) ) {
			$customer->set_first_name( sanitize_text_field( $body['firstName'] ) );
		}
		if ( isset( $body['lastName'] ) ) {
			$customer->set_last_name( sanitize_text_field( $body['lastName'] ) );
		}
		if ( isset( $body['email'] ) ) {
			$customer->set_email( sanitize_email( $body['email'] ) );
		}
		if ( isset( $body['phone'] ) ) {
			$customer->set_billing_phone( sanitize_text_field( $body['phone'] ) );
		}
		$customer->save();

		return self::get_account( $request );
	}

	public static function get_addresses( WP_REST_Request $request ) {
		$customer = new WC_Customer( self::get_authenticated_user_id( $request ) );
		return array(
			'billing'  => self::format_address( $customer, 'billing' ),
			'shipping' => self::format_address( $customer, 'shipping' ),
		);
	}

	public static function update_address( WP_REST_Request $request ) {
		$type     = $request->get_param( 'type' );
		$customer = new WC_Customer( self::get_authenticated_user_id( $request ) );
		$body     = (array) $request->get_json_params();

		$setters = array(
			'firstName' => "set_{$type}_first_name",
			'lastName'  => "set_{$type}_last_name",
			'company'   => "set_{$type}_company",
			'address1'  => "set_{$type}_address_1",
			'address2'  => "set_{$type}_address_2",
			'city'      => "set_{$type}_city",
			'state'     => "set_{$type}_state",
			'postcode'  => "set_{$type}_postcode",
			'country'   => "set_{$type}_country",
			'phone'     => "set_{$type}_phone",
		);

		foreach ( $setters as $field => $setter ) {
			if ( isset( $body[ $field ] ) && method_exists( $customer, $setter ) ) {
				$customer->$setter( sanitize_text_field( $body[ $field ] ) );
			}
		}
		$customer->save();

		return self::format_address( $customer, $type );
	}

	public static function refresh_token() {
		return MPE_Chatbot_Auth::build_widget_context_for_user( wp_get_current_user() );
	}

	private static function format_address( WC_Customer $customer, $type ) {
		$get = function ( $field ) use ( $customer, $type ) {
			$method = "get_{$type}_{$field}";
			return method_exists( $customer, $method ) ? $customer->$method() : '';
		};

		return array(
			'firstName' => $get( 'first_name' ),
			'lastName'  => $get( 'last_name' ),
			'company'   => $get( 'company' ),
			'address1'  => $get( 'address_1' ),
			'address2'  => $get( 'address_2' ),
			'city'      => $get( 'city' ),
			'state'     => $get( 'state' ),
			'postcode'  => $get( 'postcode' ),
			'country'   => $get( 'country' ),
			'phone'     => 'billing' === $type ? $customer->get_billing_phone() : $get( 'phone' ),
		);
	}
}
