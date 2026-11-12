<?php
/**
 * REST endpoints for folder CRUD and moving attachments.
 *
 * @package Media_Library_Organize
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MLO_Rest {

	const NAMESPACE_V1 = 'mlo/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route(
			self::NAMESPACE_V1,
			'/folders',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_folders' ),
					'permission_callback' => array( __CLASS__, 'can_use' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'create_folder' ),
					'permission_callback' => array( __CLASS__, 'can_use' ),
					'args'                => array(
						'name'   => array(
							'required'          => true,
							'sanitize_callback' => 'sanitize_text_field',
							'validate_callback' => array( __CLASS__, 'validate_name' ),
						),
						'parent' => array(
							'required'          => false,
							'default'           => 0,
							'sanitize_callback' => 'absint',
						),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/folders/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'update_folder' ),
					'permission_callback' => array( __CLASS__, 'can_use' ),
					'args'                => array(
						'name'   => array(
							'required'          => false,
							'sanitize_callback' => 'sanitize_text_field',
							'validate_callback' => array( __CLASS__, 'validate_name' ),
						),
						'parent' => array(
							'required'          => false,
							'sanitize_callback' => 'absint',
						),
					),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( __CLASS__, 'delete_folder' ),
					'permission_callback' => array( __CLASS__, 'can_use' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/attachments/move',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'move_attachments' ),
					'permission_callback' => array( __CLASS__, 'can_use' ),
					'args'                => array(
						'ids'     => array(
							'required'          => true,
							'sanitize_callback' => array( __CLASS__, 'sanitize_id_list' ),
						),
						'folder'  => array(
							'required'          => true,
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			)
		);
	}

	public static function can_use() {
		return current_user_can( 'upload_files' );
	}

	public static function validate_name( $value ) {
		return is_string( $value ) && '' !== trim( $value );
	}

	public static function sanitize_id_list( $value ) {
		if ( ! is_array( $value ) ) {
			return array();
		}
		return array_values( array_filter( array_map( 'absint', $value ) ) );
	}

	/**
	 * Full folder tree with attachment counts.
	 */
	public static function get_folders() {
		$terms = get_terms(
			array(
				'taxonomy'   => MLO_Taxonomy::TAXONOMY,
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		if ( is_wp_error( $terms ) ) {
			return $terms;
		}

		$out = array();
		foreach ( $terms as $term ) {
			$out[] = array(
				'id'     => (int) $term->term_id,
				'name'   => $term->name,
				'parent' => (int) $term->parent,
				'count'  => (int) $term->count,
			);
		}
		return rest_ensure_response( $out );
	}

	public static function create_folder( WP_REST_Request $request ) {
		$name   = trim( $request['name'] );
		$parent = (int) $request['parent'];

		if ( $parent > 0 ) {
			$parent_term = get_term( $parent, MLO_Taxonomy::TAXONOMY );
			if ( ! $parent_term || is_wp_error( $parent_term ) ) {
				return new WP_Error( 'mlo_invalid_parent', __( 'Parent folder does not exist.', 'media-library-organize' ), array( 'status' => 400 ) );
			}
		}

		$result = wp_insert_term( $name, MLO_Taxonomy::TAXONOMY, array( 'parent' => $parent ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$term = get_term( (int) $result['term_id'], MLO_Taxonomy::TAXONOMY );
		return rest_ensure_response(
			array(
				'id'     => (int) $term->term_id,
				'name'   => $term->name,
				'parent' => (int) $term->parent,
				'count'  => 0,
			)
		);
	}

	public static function update_folder( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$term = get_term( $id, MLO_Taxonomy::TAXONOMY );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error( 'mlo_not_found', __( 'Folder not found.', 'media-library-organize' ), array( 'status' => 404 ) );
		}

		$args = array();
		if ( null !== $request['name'] ) {
			$args['name'] = trim( $request['name'] );
		}
		if ( null !== $request['parent'] ) {
			$parent = (int) $request['parent'];
			if ( $parent === $id || self::is_descendant( $id, $parent ) ) {
				return new WP_Error( 'mlo_invalid_parent', __( 'A folder cannot be moved into itself or its own subfolder.', 'media-library-organize' ), array( 'status' => 400 ) );
			}
			$args['parent'] = $parent;
		}

		if ( empty( $args ) ) {
			return new WP_Error( 'mlo_nothing_to_update', __( 'Nothing to update.', 'media-library-organize' ), array( 'status' => 400 ) );
		}

		$result = wp_update_term( $id, MLO_Taxonomy::TAXONOMY, $args );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$term = get_term( $id, MLO_Taxonomy::TAXONOMY );
		return rest_ensure_response(
			array(
				'id'     => (int) $term->term_id,
				'name'   => $term->name,
				'parent' => (int) $term->parent,
				'count'  => (int) $term->count,
			)
		);
	}

	/**
	 * True if $candidate is $ancestor or one of its descendants.
	 */
	private static function is_descendant( $ancestor, $candidate ) {
		if ( 0 === (int) $candidate ) {
			return false;
		}
		$term   = get_term( $candidate, MLO_Taxonomy::TAXONOMY );
		$parent = $term ? (int) $term->parent : 0;
		while ( $parent > 0 ) {
			if ( $parent === (int) $ancestor ) {
				return true;
			}
			$term   = get_term( $parent, MLO_Taxonomy::TAXONOMY );
			$parent = $term ? (int) $term->parent : 0;
		}
		return false;
	}

	/**
	 * Delete a folder. Attachments are kept and become unorganized.
	 */
	public static function delete_folder( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$term = get_term( $id, MLO_Taxonomy::TAXONOMY );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error( 'mlo_not_found', __( 'Folder not found.', 'media-library-organize' ), array( 'status' => 404 ) );
		}

		// Children are promoted to the deleted folder's parent.
		$children = get_terms(
			array(
				'taxonomy' => MLO_Taxonomy::TAXONOMY,
				'parent'   => $id,
				'hide_empty' => false,
			)
		);
		if ( ! is_wp_error( $children ) ) {
			foreach ( $children as $child ) {
				wp_update_term( $child->term_id, MLO_Taxonomy::TAXONOMY, array( 'parent' => (int) $term->parent ) );
			}
		}

		$result = wp_delete_term( $id, MLO_Taxonomy::TAXONOMY );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * Move attachments to a folder ('0' = unorganized).
	 */
	public static function move_attachments( WP_REST_Request $request ) {
		$ids    = (array) $request['ids'];
		$folder = (string) $request['folder'];

		if ( '0' !== $folder ) {
			$term = get_term( (int) $folder, MLO_Taxonomy::TAXONOMY );
			if ( ! $term || is_wp_error( $term ) ) {
				return new WP_Error( 'mlo_invalid_folder', __( 'Folder does not exist.', 'media-library-organize' ), array( 'status' => 400 ) );
			}
		}

		$moved = array();
		foreach ( $ids as $id ) {
			$attachment = get_post( $id );
			if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
				continue;
			}
			if ( wp_set_object_terms( $id, '0' === $folder ? array() : array( (int) $folder ), MLO_Taxonomy::TAXONOMY, false ) ) {
				$moved[] = (int) $id;
			}
		}

		return rest_ensure_response(
			array(
				'moved'  => $moved,
				'folder' => $folder,
			)
		);
	}
}
