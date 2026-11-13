<?php
/**
 * Admin UI: assets and sidebar injection on the media library screens.
 *
 * @package Media_Library_Organize
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MLO_Admin {

	public static function init() {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
	}

	/**
	 * Load the folder UI on the media library pages (grid and list mode).
	 *
	 * @param string $hook_suffix Current admin page hook.
	 */
	public static function enqueue_assets( $hook_suffix ) {
		if ( 'upload.php' !== $hook_suffix ) {
			return;
		}

		wp_enqueue_style(
			'mlo-folders',
			MLO_URL . 'assets/css/media-folders.css',
			array(),
			MLO_VERSION
		);

		wp_enqueue_script(
			'mlo-folders',
			MLO_URL . 'assets/js/media-folders.js',
			array( 'jquery', 'jquery-ui-draggable', 'jquery-ui-droppable', 'media' ),
			MLO_VERSION,
			true
		);

		wp_localize_script(
			'mlo-folders',
			'MLO_Settings',
			array(
				'restUrl'  => esc_url_raw( rest_url( MLO_Rest::NAMESPACE_V1 . '/' ) ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'taxonomy' => MLO_Taxonomy::TAXONOMY,
				'i18n'     => array(
					'folders'       => __( 'Folders', 'media-library-organize' ),
					'allFiles'      => __( 'All files', 'media-library-organize' ),
					'unorganized'   => __( 'Unorganized', 'media-library-organize' ),
					'newFolder'     => __( 'New folder', 'media-library-organize' ),
					'addFolder'     => __( 'Add folder', 'media-library-organize' ),
					'rename'        => __( 'Rename', 'media-library-organize' ),
					'delete'        => __( 'Delete', 'media-library-organize' ),
					'confirmDelete' => __( 'Delete this folder? Files inside will become unorganized and will NOT be deleted.', 'media-library-organize' ),
					'emptyName'     => __( 'Please enter a folder name.', 'media-library-organize' ),
					'movingFailed'  => __( 'Could not move the selected items.', 'media-library-organize' ),
					'creating'      => __( 'Creating folder…', 'media-library-organize' ),
					'hideSidebar'   => __( 'Hide folder sidebar', 'media-library-organize' ),
				),
			)
		);
	}
}
