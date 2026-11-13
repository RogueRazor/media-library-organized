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
					'folders'       => __( 'Folders', 'media-library-organized' ),
					'allFiles'      => __( 'All files', 'media-library-organized' ),
					'unorganized'   => __( 'Unorganized', 'media-library-organized' ),
					'newFolder'     => __( 'New folder', 'media-library-organized' ),
					'addFolder'     => __( 'Add folder', 'media-library-organized' ),
					'rename'        => __( 'Rename', 'media-library-organized' ),
					'delete'        => __( 'Delete', 'media-library-organized' ),
					'confirmDelete' => __( 'Delete this folder? Files inside will become unorganized and will NOT be deleted.', 'media-library-organized' ),
					'emptyName'     => __( 'Please enter a folder name.', 'media-library-organized' ),
					'movingFailed'  => __( 'Could not move the selected items.', 'media-library-organized' ),
					'creating'      => __( 'Creating folder…', 'media-library-organized' ),
					'hideSidebar'   => __( 'Hide folder sidebar', 'media-library-organized' ),
					'move'          => __( 'Move', 'media-library-organized' ),
					'cancel'        => __( 'Cancel', 'media-library-organized' ),
					'selected'      => __( 'selected', 'media-library-organized' ),
				),
			)
		);
	}
}
