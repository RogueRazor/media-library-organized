<?php
/**
 * Virtual folder taxonomy for attachments.
 *
 * @package Media_Library_Organize
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MLO_Taxonomy {

	const TAXONOMY = 'mlo_media_folder';

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_taxonomy' ) );
		add_filter( 'ajax_query_attachments_args', array( __CLASS__, 'filter_grid_query' ) );
		add_filter( 'parse_query', array( __CLASS__, 'filter_list_query' ) );
		add_action( 'restrict_manage_posts', array( __CLASS__, 'list_mode_dropdown' ) );
		add_filter( 'manage_media_columns', array( __CLASS__, 'add_list_column' ) );
		add_action( 'manage_media_custom_column', array( __CLASS__, 'render_list_column' ), 10, 2 );
		add_action( 'add_attachment', array( __CLASS__, 'assign_folder_on_upload' ) );
	}

	/**
	 * Register a hierarchical taxonomy on attachments. Virtual only:
	 * attachments keep their physical file path under wp-content/uploads.
	 */
	public static function register_taxonomy() {
		register_taxonomy(
			self::TAXONOMY,
			array( 'attachment' ),
			array(
				'labels'            => array(
					'name'          => __( 'Media Folders', 'media-library-organize' ),
					'singular_name' => __( 'Media Folder', 'media-library-organize' ),
					'menu_name'     => __( 'Folders', 'media-library-organize' ),
				),
				'public'            => false,
				'hierarchical'     => true,
				'show_admin_column' => false,
				'show_ui'           => false,
				'show_in_rest'      => false,
				'query_var'         => false,
				'rewrite'           => false,
				'capabilities'      => array(
					'manage_terms' => 'upload_files',
					'edit_terms'   => 'upload_files',
					'delete_terms' => 'upload_files',
					'assign_terms' => 'upload_files',
				),
			)
		);
	}

	/**
	 * Folder id from the current request, or null.
	 *
	 * @return int|string|null
	 */
	private static function requested_folder() {
		// Grid mode (Backbone ajax) or REST upload.
		if ( isset( $_REQUEST['query']['mlo_folder'] ) ) {
			return sanitize_text_field( wp_unslash( $_REQUEST['query']['mlo_folder'] ) );
		}
		if ( isset( $_REQUEST['mlo_folder'] ) ) {
			return sanitize_text_field( wp_unslash( $_REQUEST['mlo_folder'] ) );
		}
		// List mode dropdown ('-1' is the "Unorganized" option).
		if ( isset( $_GET['mlo_folder'] ) ) {
			$folder = sanitize_text_field( wp_unslash( $_GET['mlo_folder'] ) );
			return ( '' === $folder || '-1' === $folder ) ? '0' : $folder;
		}
		return null;
	}

	/**
	 * Apply the folder filter to media grid ajax queries.
	 *
	 * @param array $query WP_Query args.
	 * @return array
	 */
	public static function filter_grid_query( $query ) {
		$folder = self::requested_folder();
		if ( null === $folder ) {
			return $query;
		}
		return self::add_folder_tax_query( $query, $folder );
	}

	/**
	 * Apply the folder filter to list-mode admin queries.
	 *
	 * @param WP_Query $query Current query.
	 */
	public static function filter_list_query( $query ) {
		if ( is_admin() && $query->is_main_query() && 'attachment' === $query->get( 'post_type' ) ) {
			$folder = self::requested_folder();
			if ( null !== $folder ) {
				$query->set( 'tax_query', self::folder_tax_query( $folder ) );
			}
		}
	}

	/**
	 * Build a tax_query array for a folder id ('0' = unorganized).
	 *
	 * @param string $folder Folder term id or '0'.
	 * @return array
	 */
	private static function folder_tax_query( $folder ) {
		if ( '0' === $folder ) {
			return array(
				array(
					'taxonomy' => self::TAXONOMY,
					'operator' => 'NOT EXISTS',
				),
			);
		}
		return array(
			array(
				'taxonomy'         => self::TAXONOMY,
				'field'            => 'term_id',
				'terms'            => (int) $folder,
				'include_children' => true,
			),
		);
	}

	private static function add_folder_tax_query( $query, $folder ) {
		$tax_query = self::folder_tax_query( $folder );
		if ( isset( $query['tax_query'] ) ) {
			$tax_query['relation'] = 'AND';
			$tax_query[]          = $query['tax_query'];
		}
		$query['tax_query'] = $tax_query;
		return $query;
	}

	/**
	 * Folder dropdown for list mode.
	 */
	public static function list_mode_dropdown() {
		global $typenow;
		if ( 'attachment' !== $typenow ) {
			return;
		}
		$dropdown_args = array(
			'taxonomy'        => self::TAXONOMY,
			'show_option_all' => __( 'All folders', 'media-library-organize' ),
			'show_option_none' => __( 'Unorganized', 'media-library-organize' ),
			'hide_empty'      => false,
			'hierarchical'    => true,
			'name'            => 'mlo_folder',
			'id'              => 'mlo_folder',
			'value_field'     => 'term_id',
			'selected'        => isset( $_GET['mlo_folder'] ) ? sanitize_text_field( wp_unslash( $_GET['mlo_folder'] ) ) : '',
		);
		echo '<label class="screen-reader-text" for="mlo_folder">' . esc_html__( 'Filter by folder', 'media-library-organize' ) . '</label>';
		wp_dropdown_categories( $dropdown_args );
	}

	/**
	 * Folder column header in list mode.
	 *
	 * @param array $columns Columns.
	 * @return array
	 */
	public static function add_list_column( $columns ) {
		$columns['mlo_folder'] = __( 'Folder', 'media-library-organize' );
		return $columns;
	}

	/**
	 * Folder column content in list mode.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Attachment id.
	 */
	public static function render_list_column( $column, $post_id ) {
		if ( 'mlo_folder' !== $column ) {
			return;
		}
		$terms = get_the_terms( $post_id, self::TAXONOMY );
		if ( $terms && ! is_wp_error( $terms ) ) {
			$out = array();
			foreach ( $terms as $term ) {
				$out[] = esc_html( $term->name );
			}
			echo esc_html( implode( ', ', $out ) );
		} else {
			echo '<span aria-hidden="true">&mdash;</span>';
		}
	}

	/**
	 * When uploading from the media grid, put the file in the active folder.
	 *
	 * @param int $attachment_id Attachment id.
	 */
	public static function assign_folder_on_upload( $attachment_id ) {
		$folder = self::requested_folder();
		if ( null === $folder || '0' === $folder || '' === $folder ) {
			return;
		}
		$term = get_term( (int) $folder, self::TAXONOMY );
		if ( $term && ! is_wp_error( $term ) ) {
			wp_set_object_terms( $attachment_id, array( (int) $term->term_id ), self::TAXONOMY, false );
		}
	}
}
