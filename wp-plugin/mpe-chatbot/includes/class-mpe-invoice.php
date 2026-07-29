<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Best-effort auto-detection for popular WooCommerce invoice plugins, wired into
 * the mpe_chatbot_invoice_url filter consumed by MPE_Chatbot_Orders_Controller.
 * Only relevant when the chatbot server's INVOICE_STRATEGY=wp_plugin_url — the
 * default backend_pdf strategy never calls /orders/{id}/invoice-url at all, so
 * most installs can ignore this file entirely.
 */
add_filter(
	'mpe_chatbot_invoice_url',
	function ( $url, $order ) {
		if ( $url ) {
			return $url;
		}

		// WooCommerce PDF Invoices & Packing Slips (WP Overnight / wpovernight.com).
		if ( function_exists( 'wcpdf_get_document_link' ) ) {
			$link = wcpdf_get_document_link( $order, 'invoice' );
			if ( $link ) {
				return $link;
			}
		}

		// YITH WooCommerce PDF Invoices.
		if ( class_exists( 'YITH_WooCommerce_PDF_Invoice' ) && method_exists( 'YITH_WooCommerce_PDF_Invoice', 'get_instance' ) ) {
			$instance = YITH_WooCommerce_PDF_Invoice::get_instance();
			if ( is_object( $instance ) && method_exists( $instance, 'get_download_link' ) ) {
				$link = $instance->get_download_link( $order->get_id() );
				if ( $link ) {
					return $link;
				}
			}
		}

		return null;
	},
	10,
	2
);
