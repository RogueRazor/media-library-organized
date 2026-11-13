<?php
/**
 * Plugin Name:       Media Library Organize
 * Description:       Organize your WordPress media library with virtual drag-and-drop folders, inspired by FileBird. Files stay in place — only the folder tree changes.
 * Version:           1.0.4
 * Requires at least:  5.6
 * Requires PHP:       7.2
 * Author:             RogueRazor
 * Update URI:        https://github.com/RogueRazor/media-library-organized
 * License:            GPL-2.0-or-later
 * License URI:        https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:        media-library-organized
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MLO_VERSION', '1.0.4' );
define( 'MLO_FILE', __FILE__ );
define( 'MLO_DIR', plugin_dir_path( __FILE__ ) );
define( 'MLO_URL', plugin_dir_url( __FILE__ ) );

require_once MLO_DIR . 'includes/class-mlo-taxonomy.php';
require_once MLO_DIR . 'includes/class-mlo-rest.php';
require_once MLO_DIR . 'includes/class-mlo-admin.php';
require_once MLO_DIR . 'includes/class-mlo-updater.php';

/**
 * Init plugin components.
 */
function mlo_init() {
	MLO_Taxonomy::init();
	MLO_Rest::init();
	MLO_Admin::init();
}
add_action( 'plugins_loaded', 'mlo_init' );

add_action( 'init', array( 'MLO_Updater', 'init' ) );
