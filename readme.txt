=== Media Library Organize ===
Contributors: vibe
Tags: media, folders, media library, organization, file manager
Requires at least: 5.6
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.0.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Organize your WordPress media library with virtual drag-and-drop folders, inspired by FileBird.

== Description ==

Media Library Organize adds a folder tree sidebar to your media library so you can keep
thousands of uploads tidy. Folders are virtual: files never move on disk and stay in
wp-content/uploads, so deactivating the plugin leaves your media library untouched.

Features:

* Unlimited nested folders
* Folder tree sidebar in the media library grid with collapsible subfolders
* Drag-and-drop files into folders (multi-select supported)
* Drag-and-drop folders into other folders to re-parent them
* Create, rename, and delete folders (deleting never deletes files)
* "All files" and "Unorganized" smart views
* Filter the grid and list view by folder
* Uploads from the media grid land in the active folder
* REST API endpoints under mlo/v1 with capability checks (upload_files)

== Installation ==

1. Download `media-library-organized.zip` from the plugin's GitHub releases page.
2. Install it via Plugins → Add New → Upload Plugin (or upload the extracted `media-library-organized` folder to `/wp-content/plugins/`).
3. Activate the plugin through the Plugins screen in WordPress.
4. Open Media Library — the Folders sidebar appears on the left.

== Frequently Asked Questions ==

= Does this move my files on the server? =

No. Folders are a virtual taxonomy. Physical files stay in wp-content/uploads.

= What happens when I delete a folder? =

The folder is removed and its files become "Unorganized". Subfolders move up one level.
No files are ever deleted.

= What happens when I deactivate the plugin? =

Your media library returns to the default WordPress view. All files remain.

== Changelog ==

= 1.0.4 =
* Fixed: dropping files onto folders (drop targets in the sidebar were never initialized)
* Added: "Move selected" bar in grid mode — bulk-move files to any folder from a dropdown, no drag needed

= 1.0.3 =
* Renamed plugin folder and main file to `media-library-organized` to match the GitHub repo — everything now shares one name
* Releases now ship an installable `media-library-organized.zip` with the correct folder structure

= 1.0.2 =
* Fixed: update from GitHub now matches the plugin's actual installed folder name, so the update row appears and can be clicked in Dashboard → Updates and on the Plugins screen

= 1.0.1 =
* Fixed: drag-and-drop of attachments into folders (draggable was never initialized)
* Fixed: folders can now be dragged into other folders
* Fixed: content area no longer double-indented next to the sidebar
* Added: show/hide toggle for the folder sidebar (remembered per browser)
* Added: sidebar folder clicks now filter list mode too

= 1.0.0 =
* Initial release: folder tree, drag-and-drop, CRUD, grid + list filtering, upload targeting.
