<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * /orders, /orders/{id}, /orders/{id}/invoice-data, /orders/{id}/invoice-url.
 * Every single-order route re-checks that the order's customer_id matches the
 * authenticated token's uid (get_owned_order) — a valid token never grants
 * access to another customer's order just by guessing an id.
 */
class MPE_Chatbot_Orders_Controller extends MPE_Chatbot_REST_Controller {

	public static function register() {
		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/orders',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'list_orders' ),
				'permission_callback' => array( __CLASS__, 'authenticate' ),
			)
		);

		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/orders/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_order' ),
				'permission_callback' => array( __CLASS__, 'authenticate' ),
			)
		);

		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/orders/(?P<id>\d+)/invoice-data',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_invoice_data' ),
				'permission_callback' => array( __CLASS__, 'authenticate' ),
			)
		);

		register_rest_route(
			MPE_CHATBOT_REST_NAMESPACE,
			'/orders/(?P<id>\d+)/invoice-url',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_invoice_url' ),
				'permission_callback' => array( __CLASS__, 'authenticate' ),
			)
		);
	}

	public static function list_orders( WP_REST_Request $request ) {
		$user_id  = self::get_authenticated_user_id( $request );
		$page     = max( 1, (int) $request->get_param( 'page' ) ?: 1 );
		$per_page = min( 20, max( 1, (int) $request->get_param( 'per_page' ) ?: 10 ) );

		$orders = wc_get_orders(
			array(
				'customer_id' => $user_id,
				'limit'       => $per_page,
				'page'        => $page,
				'orderby'     => 'date',
				'order'       => 'DESC',
				'return'      => 'objects',
			)
		);

		$total_ids = wc_get_orders(
			array(
				'customer_id' => $user_id,
				'return'      => 'ids',
				'limit'       => -1,
			)
		);

		return array(
			'total'  => count( $total_ids ),
			'orders' => array_map( array( __CLASS__, 'format_order_summary' ), $orders ),
		);
	}

	public static function get_order( WP_REST_Request $request ) {
		$order = self::get_owned_order( $request );
		return is_wp_error( $order ) ? $order : self::format_order_detail( $order );
	}

	public static function get_invoice_data( WP_REST_Request $request ) {
		$order = self::get_owned_order( $request );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		$detail = self::format_order_detail( $order );
		return array(
			'orderId'     => $detail['id'],
			'orderNumber' => $detail['number'],
			'dateCreated' => $detail['dateCreated'],
			'currency'    => $detail['currency'],
			'lineItems'   => $detail['lineItems'],
			'total'       => $detail['total'],
			'billing'     => $detail['billing'],
			'shipping'    => $detail['shipping'],
		);
	}

	public static function get_invoice_url( WP_REST_Request $request ) {
		$order = self::get_owned_order( $request );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		/**
		 * Filter: mpe_chatbot_invoice_url — return a download URL for this order's
		 * invoice from whatever WP invoice plugin is installed. See
		 * includes/class-mpe-invoice.php for a best-effort default implementation.
		 * Only used when the chatbot server's INVOICE_STRATEGY=wp_plugin_url.
		 */
		$url = apply_filters( 'mpe_chatbot_invoice_url', null, $order );

		if ( ! $url ) {
			return new WP_Error(
				'mpe_chatbot_no_invoice_plugin',
				'No WP invoice plugin was detected. Either set INVOICE_STRATEGY=backend_pdf on the chatbot server (recommended, no plugin needed), or hook the mpe_chatbot_invoice_url filter to your invoice plugin.',
				array( 'status' => 404 )
			);
		}

		return array( 'url' => $url );
	}

	/**
	 * @return WC_Order|WP_Error
	 */
	private static function get_owned_order( WP_REST_Request $request ) {
		$order_id = (int) $request->get_param( 'id' );
		$user_id  = self::get_authenticated_user_id( $request );
		$order    = wc_get_order( $order_id );

		if ( ! $order ) {
			return new WP_Error( 'mpe_chatbot_order_not_found', 'Order not found', array( 'status' => 404 ) );
		}
		if ( (int) $order->get_customer_id() !== $user_id ) {
			return new WP_Error( 'mpe_chatbot_forbidden', 'This order does not belong to the authenticated user', array( 'status' => 403 ) );
		}
		return $order;
	}

	private static function format_order_summary( WC_Order $order ) {
		$items = array();
		foreach ( $order->get_items() as $item ) {
			$items[] = $item->get_quantity() . 'x ' . $item->get_name();
		}

		return array(
			'id'           => $order->get_id(),
			'number'       => $order->get_order_number(),
			'status'       => $order->get_status(),
			'total'        => (float) $order->get_total(),
			'currency'     => $order->get_currency(),
			'dateCreated'  => $order->get_date_created() ? $order->get_date_created()->date( DATE_ATOM ) : null,
			'itemsSummary' => implode( ', ', $items ),
		);
	}

	private static function format_order_detail( WC_Order $order ) {
		$summary    = self::format_order_summary( $order );
		$line_items = array();
		foreach ( $order->get_items() as $item ) {
			$product      = $item->get_product();
			$line_items[] = array(
				'name'     => $item->get_name(),
				'quantity' => $item->get_quantity(),
				'total'    => (float) $item->get_total(),
				'sku'      => $product ? $product->get_sku() : null,
			);
		}

		$format_address = function ( $type ) use ( $order ) {
			return array(
				'firstName' => $order->{"get_{$type}_first_name"}(),
				'lastName'  => $order->{"get_{$type}_last_name"}(),
				'company'   => $order->{"get_{$type}_company"}(),
				'address1'  => $order->{"get_{$type}_address_1"}(),
				'address2'  => $order->{"get_{$type}_address_2"}(),
				'city'      => $order->{"get_{$type}_city"}(),
				'state'     => $order->{"get_{$type}_state"}(),
				'postcode'  => $order->{"get_{$type}_postcode"}(),
				'country'   => $order->{"get_{$type}_country"}(),
				'phone'     => 'billing' === $type ? $order->get_billing_phone() : '',
			);
		};

		return array_merge(
			$summary,
			array(
				'lineItems'          => $line_items,
				'billing'            => $format_address( 'billing' ),
				'shipping'           => $format_address( 'shipping' ),
				'paymentMethodTitle' => $order->get_payment_method_title(),
			)
		);
	}
}
