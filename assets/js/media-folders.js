/**
 * Media Library Organize — folder tree sidebar.
 *
 * Adds a FileBird-style folder tree to the media library grid, with
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
		current: null // null = all files, '0' = unorganized, int = folder id
	};

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
		var $label = $('<span>', {
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
		makeFoldersDroppable($list);
	}

	function markActive() {
		$('#mlo-folder-tree .mlo-folder').toggleClass(
			'mlo-active',
			false
		);
		$('#mlo-all-files').toggleClass('mlo-active', state.current === null);
		$('#mlo-unorganized').toggleClass('mlo-active', state.current === '0');
		if (state.current !== null && state.current !== '0') {
			$('#mlo-folder-tree .mlo-folder[data-id="' + state.current + '"]').addClass('mlo-active');
		}
	}

	// ---------------------------------------------------------------------------
	// Grid filtering
	// ---------------------------------------------------------------------------

	function applyFilter() {
		var frame = wp.media && wp.media.frame;
		if (!frame || !frame.library) {
			return;
		}
		if (state.current === null) {
			frame.library.props.unset('mlo_folder', { silent: true });
			frame.library.props.set('mlo_folder', null);
		} else {
			frame.library.props.set('mlo_folder', String(state.current));
		}
		// Force a requery even when the value did not change.
		frame.library.more();
		frame.library.trigger('reset');
	}

	// ---------------------------------------------------------------------------
	// Drag & drop
	// ---------------------------------------------------------------------------

	function selectedAttachmentIds($item) {
		var ids = [];
		var frame = wp.media && wp.media.frame;
		if (frame && frame.state() && frame.state().get('selection')) {
			frame.state().get('selection').each(function (model) {
				ids.push(model.id);
			});
		}
		if (!ids.length && $item) {
			ids.push($item.closest('.attachment, li').data('id'));
		}
		return _.uniq(ids);
	}

	function makeAttachmentsDraggable() {
		var frame = wp.media && wp.media.frame;
		if (!frame || !frame.content || !frame.content.get()) {
			return;
		}
		var $attachments = frame.content.get().$el.find('.attachment');
		$attachments.draggable({
			helper: 'clone',
			revert: 'invalid',
			cursor: 'move',
			start: function () {
				$(this).addClass('mlo-dragging');
			},
			stop: function () {
				$(this).removeClass('mlo-dragging');
			}
		});
	}

	function makeFoldersDroppable($scope) {
		$('.mlo-folder-row', $scope).droppable({
			accept: '.attachment, .mlo-folder',
			hoverClass: 'mlo-drop-hover',
			tolerance: 'pointer',
			drop: function (event, ui) {
				var $folderRow = $(this);
				var folderId = $folderRow.closest('.mlo-folder').data('id');
				if (ui.draggable.hasClass('mlo-folder')) {
					var draggedId = ui.draggable.data('id');
					if (draggedId === folderId) {
						return;
					}
					request('POST', 'folders/' + draggedId, { parent: folderId }).done(function () {
						loadFolders();
					});
				} else {
					var ids = selectedAttachmentIds(ui.draggable);
					if (!ids.length) {
						ids = [ui.draggable.data('id')];
					}
					moveAttachments(ids, folderId);
				}
			}
		});
	}

	function moveAttachments(ids, folderId) {
		request('POST', 'attachments/move', {
			ids: ids,
			folder: String(folderId)
		}).done(function () {
			loadFolders();
			var frame = wp.media && wp.media.frame;
			if (frame && frame.library) {
				frame.library.trigger('reset');
			}
		}).fail(function () {
			window.alert(api.i18n.movingFailed);
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
	// Sidebar
	// ---------------------------------------------------------------------------

	function buildSidebar() {
		var $sidebar = $(
			'<div id="mlo-sidebar" class="mlo-sidebar">' +
				'<div class="mlo-sidebar-header">' +
					'<span class="mlo-sidebar-title"></span>' +
					'<button type="button" id="mlo-add-folder" class="button button-small" title="' + api.i18n.addFolder + '">+</button>' +
				'</div>' +
				'<ul class="mlo-static-list">' +
					'<li id="mlo-all-files" class="mlo-static-item mlo-active"><span class="mlo-folder-icon">\uD83C\uDF10</span> ' + api.i18n.allFiles + '</li>' +
					'<li id="mlo-unorganized" class="mlo-static-item"><span class="mlo-folder-icon">\uD83D\uDDC2</span> ' + api.i18n.unorganized + '</li>' +
				'</ul>' +
				'<ul id="mlo-folder-tree" class="mlo-folder-tree"></ul>' +
			'</div>'
		);
		$sidebar.find('.mlo-sidebar-title').text(api.i18n.folders);
		$('#wpbody-content').prepend($sidebar);
		$('body').addClass('mlo-has-sidebar');

		bindSidebarEvents();
	}

	function bindSidebarEvents() {
		$(document)
			.on('click', '#mlo-add-folder', function () {
				createFolder(0);
			})
			.on('click', '#mlo-all-files', function () {
				state.current = null;
				markActive();
				applyFilter();
			})
			.on('click', '#mlo-unorganized', function () {
				state.current = '0';
				markActive();
				applyFilter();
			})
			.on('click', '#mlo-folder-tree .mlo-folder-row', function (e) {
				var $folder = $(this).closest('.mlo-folder');
				if ($(e.target).hasClass('mlo-folder-caret')) {
					$folder.toggleClass('mlo-collapsed');
					return;
				}
				state.current = $folder.data('id');
				markActive();
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

		// Uploads land in the active folder.
		$(document).on('ajaxSuccess', function (event, xhr, settings, data) {
			if (settings && /action=upload-attachment/.test(settings.data || '')) {
				var frame = wp.media && wp.media.frame;
				if (frame && frame.library) {
					frame.library.more();
				}
			}
		});
	}

	// ---------------------------------------------------------------------------
	// Boot
	// ---------------------------------------------------------------------------

	function watchGrid() {
		var frame = wp.media && wp.media.frame;
		if (!frame) {
			return;
		}
		frame.on('content:render:browse', function () {
			window.setTimeout(function () {
				makeAttachmentsDraggable();
				if (frame.uploader && frame.uploader.uploader) {
					frame.uploader.uploader.bind('BeforeUpload', function (up) {
						up.settings.multipart_params.mlo_folder =
							state.current === null ? '' : String(state.current);
					});
				}
			}, 100);
		});
		frame.on('attachments:render', makeAttachmentsDraggable);
	}

	function boot() {
		if ($('#mlo-sidebar').length) {
			return;
		}
		buildSidebar();
		loadFolders();
		watchGrid();
	}

	$(function () {
		// Grid mode boots Backbone after DOM ready; wait for the frame.
		var tries = 0;
		var timer = window.setInterval(function () {
			tries += 1;
			var gridFrame = wp.media && wp.media.frame;
			var isGrid = $('body').hasClass('upload-php') && !$('.wp-list-table.media').length;
			if (gridFrame || !isGrid || tries > 40) {
				window.clearInterval(timer);
				boot();
			}
		}, 250);
	});
})(jQuery);
