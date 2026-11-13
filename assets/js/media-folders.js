/**
 * Media Library Organize — folder tree sidebar.
 *
 * Adds a FileBird-style folder tree to the media library, with
 * drag-and-drop for attachments and folders, plus REST-backed CRUD.
 */
/* global jQuery, _, wp, MLO_Settings */
(function ($) {
	'use strict';

	var api = {
		root: MLO_Settings.restUrl,
		nonce: MLO_Settings.nonce,
		i18n: MLO_Settings.i18n
	};

	var state = {
		folders: [],
		current: null, // null = all files, '0' = unorganized, int = folder id
		gridObserver: null
	};

	// ---------------------------------------------------------------------------
	// REST helpers
	// ---------------------------------------------------------------------------

	function request(method, path, data) {
		return $.ajax({
			url: api.root + path,
			method: method,
			beforeSend: function (xhr) {
				xhr.setRequestHeader('X-WP-Nonce', api.nonce);
			},
			data: data ? JSON.stringify(data) : null,
			contentType: 'application/json',
			dataType: 'json'
		});
	}

	function loadFolders() {
		return request('GET', 'folders').done(function (folders) {
			state.folders = folders || [];
			renderTree();
		});
	}

	// ---------------------------------------------------------------------------
	// Tree rendering
	// ---------------------------------------------------------------------------

	function buildTree() {
		var byParent = {};
		_.each(state.folders, function (folder) {
			byParent[folder.parent] = byParent[folder.parent] || [];
			byParent[folder.parent].push(folder);
		});
		_.each(byParent, function (children) {
			children.sort(function (a, b) {
				return a.name.localeCompare(b.name);
			});
		});
		return byParent;
	}

	function folderLi(folder, byParent) {
		var $li = $('<li>', {
			'class': 'mlo-folder',
			'data-id': folder.id
		});
		var $row = $('<div>', { 'class': 'mlo-folder-row' }).appendTo($li);
		$('<span>', { 'class': 'mlo-folder-caret', text: '\u25B8' }).appendTo($row);
		$('<span>', { 'class': 'mlo-folder-icon', text: '\uD83D\uDCC1' }).appendTo($row);
		$('<span>', {
			'class': 'mlo-folder-name',
			text: folder.name,
			title: folder.name
		}).appendTo($row);
		$('<span>', { 'class': 'mlo-folder-count', text: folder.count }).appendTo($row);
		$('<button>', {
			'class': 'mlo-folder-rename',
			type: 'button',
			title: api.i18n.rename,
			text: '\u270E'
		}).appendTo($row);
		$('<button>', {
			'class': 'mlo-folder-delete',
			type: 'button',
			title: api.i18n.delete,
			text: '\u00D7'
		}).appendTo($row);

		var $children = $('<ul>', { 'class': 'mlo-folder-children' }).appendTo($li);
		_.each(byParent[folder.id] || [], function (child) {
			$children.append(folderLi(child, byParent));
		});
		if ($children.children().length) {
			$li.addClass('mlo-has-children');
		}
		return $li;
	}

	function renderTree() {
		var $list = $('#mlo-folder-tree');
		if (!$list.length) {
			return;
		}
		$list.empty();
		var byParent = buildTree();
		_.each(byParent[0] || [], function (folder) {
			$list.append(folderLi(folder, byParent));
		});
		markActive();
	}

	// ---------------------------------------------------------------------------
	// Filtering (grid mode via Backbone, list mode via URL)
	// ---------------------------------------------------------------------------

	function isGridMode() {
		return !!(wp.media && wp.media.frame && wp.media.frame.library);
	}

	function applyFilter() {
		markActive();
		if (isGridMode()) {
			var props = wp.media.frame.library.props;
			// Unset first so re-setting the same value triggers a requery.
			props.unset('mlo_folder', { silent: true });
			if (state.current === null) {
				props.set('mlo_folder', null);
			} else {
				props.set('mlo_folder', String(state.current));
			}
		} else {
			var params = new URLSearchParams(window.location.search);
			if (state.current === null) {
				params.delete('mlo_folder');
			} else {
				params.set('mlo_folder', String(state.current));
			}
			params.set('mode', 'list');
			window.location.search = params.toString();
		}
	}

	function refreshGrid() {
		if (!isGridMode()) {
			return;
		}
		var props = wp.media.frame.library.props;
		props.unset('mlo_folder', { silent: true });
		if (state.current !== null) {
			props.set('mlo_folder', String(state.current));
		} else {
			props.set('mlo_folder', null);
		}
	}

	function markActive() {
		$('#mlo-folder-tree .mlo-folder').removeClass('mlo-active');
		$('#mlo-all-files').toggleClass('mlo-active', state.current === null);
		$('#mlo-unorganized').toggleClass('mlo-active', state.current === '0');
		if (state.current !== null && state.current !== '0') {
			$('#mlo-folder-tree .mlo-folder[data-id="' + state.current + '"]').addClass('mlo-active');
		}
	}

	// ---------------------------------------------------------------------------
	// Drag & drop
	// ---------------------------------------------------------------------------

	function makeDraggable($scope) {
		$('.attachment', $scope).not('.mlo-drag-init').each(function () {
			$(this)
				.addClass('mlo-drag-init')
				.draggable({
					helper: 'clone',
					revert: 'invalid',
					cursor: 'move',
					distance: 8,
					opacity: 0.7,
					zIndex: 100000,
					start: function () {
						$(this).addClass('mlo-dragging');
					},
					stop: function () {
						$(this).removeClass('mlo-dragging');
					}
				});
		});

		$('.mlo-folder-row', $scope).not('.mlo-drag-init').each(function () {
			$(this)
				.addClass('mlo-drag-init')
				.draggable({
					helper: 'clone',
					revert: 'invalid',
					cursor: 'move',
					distance: 8,
					opacity: 0.7,
					zIndex: 100000
				});
		});

		$('.mlo-folder-row', $scope).not('.mlo-drop-init').each(function () {
			$(this)
				.addClass('mlo-drop-init')
				.droppable({
					accept: '.attachment, .mlo-folder-row',
					hoverClass: 'mlo-drop-hover',
					tolerance: 'pointer',
					drop: function (event, ui) {
						var $target = $(this).closest('.mlo-folder');
						var targetId = $target.data('id');
						if (ui.draggable.hasClass('mlo-folder-row')) {
							var draggedId = ui.draggable.closest('.mlo-folder').data('id');
							if (String(draggedId) === String(targetId)) {
								return;
							}
							request('POST', 'folders/' + draggedId, { parent: targetId }).done(function () {
								loadFolders();
							});
						} else {
							var ids = selectedAttachmentIds(ui.draggable);
							if (!ids.length) {
								ids = [ui.draggable.data('id')];
							}
							moveAttachments(ids, targetId);
						}
					}
				});
		});
	}

	function selectedAttachmentIds($item) {
		var ids = [];
		var frame = wp.media && wp.media.frame;
		if (frame && frame.state && frame.state() && frame.state().get('selection')) {
			frame.state().get('selection').each(function (model) {
				ids.push(model.id);
			});
		}
		if (!ids.length && $item && $item.data('id')) {
			ids.push($item.data('id'));
		}
		return _.uniq(ids);
	}

	function moveAttachments(ids, folderId) {
		request('POST', 'attachments/move', {
			ids: ids,
			folder: String(folderId)
		}).done(function () {
			loadFolders();
			refreshGrid();
		}).fail(function () {
			window.alert(api.i18n.movingFailed);
		});
	}

	// Watch the grid DOM so items loaded later (scroll/pagination) become draggable too.
	function observeGrid(view) {
		if (state.gridObserver) {
			state.gridObserver.disconnect();
		}
		var timer = null;
		state.gridObserver = new MutationObserver(function () {
			window.clearTimeout(timer);
			timer = window.setTimeout(function () {
				makeDraggable(view.$el);
			}, 100);
		});
		state.gridObserver.observe(view.el, { childList: true, subtree: true });
	}

	function watchFrame() {
		var frame = wp.media && wp.media.frame;
		if (!frame || !frame.library) {
			return;
		}

		var applyToFrame = function () {
			var view = frame.content && frame.content.get();
			if (view && view.$el && view.$el.length) {
				makeDraggable(view.$el);
				observeGrid(view);
			}
		};

		frame.on('content:render:browse', function () {
			window.setTimeout(applyToFrame, 60);
		});
		window.setTimeout(applyToFrame, 60);

		bindUploader();
		frame.on('ready', bindUploader);
	}

	// New uploads land in the active folder.
	function bindUploader() {
		var frame = wp.media && wp.media.frame;
		var view = frame && frame.uploader;
		var uploader = view && view.uploader;
		var plupload = uploader && (uploader.uploader || uploader);
		if (!plupload || plupload._mloBound) {
			return;
		}
		plupload._mloBound = true;
		plupload.bind('BeforeUpload', function (up) {
			up.settings.multipart_params.mlo_folder =
				state.current === null ? '' : String(state.current);
		});
	}

	// ---------------------------------------------------------------------------
	// Folder CRUD UI
	// ---------------------------------------------------------------------------

	function createFolder(parent) {
		var name = window.prompt(api.i18n.newFolder);
		if (!name || !name.trim()) {
			return;
		}
		request('POST', 'folders', {
			name: name.trim(),
			parent: parent || 0
		}).done(function () {
			loadFolders();
		});
	}

	function renameFolder($folder) {
		var id = $folder.data('id');
		var $label = $folder.find('.mlo-folder-name').first();
		var name = window.prompt(api.i18n.rename, $label.text());
		if (name === null) {
			return;
		}
		name = name.trim();
		if (!name) {
			window.alert(api.i18n.emptyName);
			return;
		}
		request('POST', 'folders/' + id, { name: name }).done(function () {
			loadFolders();
		});
	}

	function deleteFolder($folder) {
		var id = $folder.data('id');
		if (!window.confirm(api.i18n.confirmDelete)) {
			return;
		}
		request('DELETE', 'folders/' + id).done(function () {
			if (String(state.current) === String(id)) {
				state.current = null;
				applyFilter();
			}
			loadFolders();
		});
	}

	// ---------------------------------------------------------------------------
	// Sidebar (with show/hide toggle)
	// ---------------------------------------------------------------------------

	var STORAGE_KEY = 'mlo-sidebar-hidden';

	function sidebarHidden() {
		try {
			return window.localStorage.getItem(STORAGE_KEY) === '1';
		} catch (e) {
			return false;
		}
	}

	function setSidebarHidden(hidden) {
		try {
			window.localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
		} catch (e) {}
		$('body')
			.toggleClass('mlo-sidebar-hidden', hidden)
			.toggleClass('mlo-has-sidebar', !hidden);
	}

	function buildSidebar() {
		var $sidebar = $(
			'<div id="mlo-sidebar" class="mlo-sidebar">' +
				'<div class="mlo-sidebar-header">' +
					'<span class="mlo-sidebar-title"></span>' +
					'<span class="mlo-sidebar-actions">' +
						'<button type="button" id="mlo-add-folder" class="button button-small" title="' + api.i18n.addFolder + '">+</button>' +
						'<button type="button" id="mlo-toggle-sidebar" class="button button-small" title="' + api.i18n.hideSidebar + '">&laquo;</button>' +
					'</span>' +
				'</div>' +
				'<ul class="mlo-static-list">' +
					'<li id="mlo-all-files" class="mlo-static-item mlo-active"><span class="mlo-folder-icon">\uD83C\uDF10</span> ' + api.i18n.allFiles + '</li>' +
					'<li id="mlo-unorganized" class="mlo-static-item"><span class="mlo-folder-icon">\uD83D\uDDC2</span> ' + api.i18n.unorganized + '</li>' +
				'</ul>' +
				'<ul id="mlo-folder-tree" class="mlo-folder-tree"></ul>' +
			'</div>' +
			'<button type="button" id="mlo-show-sidebar" class="button">&rsaquo; ' + api.i18n.folders + '</button>'
		);
		$sidebar.filter('.mlo-sidebar').find('.mlo-sidebar-title').text(api.i18n.folders);
		$('#wpbody-content').prepend($sidebar);
		setSidebarHidden(sidebarHidden());
	}

	function bindSidebarEvents() {
		$(document)
			.on('click', '#mlo-add-folder', function () {
				createFolder(0);
			})
			.on('click', '#mlo-toggle-sidebar', function () {
				setSidebarHidden(true);
			})
			.on('click', '#mlo-show-sidebar', function () {
				setSidebarHidden(false);
			})
			.on('click', '#mlo-all-files', function () {
				state.current = null;
				applyFilter();
			})
			.on('click', '#mlo-unorganized', function () {
				state.current = '0';
				applyFilter();
			})
			.on('click', '#mlo-folder-tree .mlo-folder-row', function (e) {
				if ($(e.target).hasClass('mlo-folder-caret')) {
					$(this).closest('.mlo-folder').toggleClass('mlo-collapsed');
					return;
				}
				state.current = $(this).closest('.mlo-folder').data('id');
				applyFilter();
			})
			.on('click', '#mlo-folder-tree .mlo-folder-rename', function (e) {
				e.stopPropagation();
				renameFolder($(this).closest('.mlo-folder'));
			})
			.on('click', '#mlo-folder-tree .mlo-folder-delete', function (e) {
				e.stopPropagation();
				deleteFolder($(this).closest('.mlo-folder'));
			});
	}

	// ---------------------------------------------------------------------------
	// Boot
	// ---------------------------------------------------------------------------

	function boot() {
		if ($('#mlo-sidebar').length) {
			return;
		}
		buildSidebar();
		bindSidebarEvents();
		loadFolders();
		watchFrame();
	}

	$(function () {
		// Grid mode boots Backbone after DOM ready; wait for the frame (or list mode).
		var tries = 0;
		var timer = window.setInterval(function () {
			tries += 1;
			var frameReady = wp.media && wp.media.frame;
			var isListMode = $('.wp-list-table.media').length > 0;
			if (frameReady || isListMode || tries > 40) {
				window.clearInterval(timer);
				boot();
			}
		}, 250);
	});
})(jQuery);
