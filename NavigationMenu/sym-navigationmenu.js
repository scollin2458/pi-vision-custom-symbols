
/**
# ***********************************************************************
# * DISCLAIMER:
# *
# * Code generated with ChatGPT.
# * Not to be used for production purpose.
# * InSource provides no guarantee nor implies any reliability,
# * serviceability, or function of these programs.
# * ALL PROGRAMS CONTAINED HEREIN ARE PROVIDED TO YOU "AS IS"
# * WITHOUT ANY WARRANTIES OF ANY KIND. ALL WARRANTIES INCLUDING
# * THE IMPLIED WARRANTIES OF NON-INFRINGEMENT, MERCHANTABILITY
# * AND FITNESS FOR A PARTICULAR PURPOSE ARE EXPRESSLY DISCLAIMED.
# ************************************************************************
#
#
**/

(function (PV) {
  'use strict';

  function symbolVis() { }
  PV.deriveVisualizationFromBase(symbolVis);

  var definition = {
    typeName: 'navigationmenu',
    displayName: 'Navigation Menu',
    datasourceBehavior: PV.Extensibility.Enums.DatasourceBehaviors.Multiple,
    iconUrl: '/Scripts/app/editor/symbols/ext/Icons/navigationmenu.svg',
    visObjectType: symbolVis,
    getDefaultConfig: function () {
      return {
        DataShape: 'Table',

        Height: 200,
        Width: 250,

        // Layout
        Orientation: 'Vertical',      // Vertical | Horizontal
        SortMode: 'AsAdded',          // AsAdded | LabelAsc
        HideBadOrEmpty: true,

        // Navigation behavior (global)
        OpenMode: 'SameTab',          // SameTab | NewTab | Popup
        PopupWidth: 1200,
        PopupHeight: 800,

        // Labels
        DefaultLabelMode: 'ElementAttribute', // None | Element | Attribute | ElementAttribute | Custom
        ButtonLabelSettings: {},              // keyed by normalized key "Element|Attribute"
        SelectedButtonIndex: 0,

        // Icons / Logos (per button)
        ButtonIconSettings: {},               // keyed by normalized key, e.g. { "Plant|URL": { IconType:"Home" } }
        IconSizePx: 18,                       // clamped in JS
        SaveSelectedButtonTrigger: 0,
        ButtonEditorLabelMode: '__DEFAULT__',
        ButtonEditorCustomLabel: '',
        ButtonEditorIconType: 'None',
        ButtonEditorIconSizeInput: '18',

        // Internal (for config pane)
        _datasourceList: [],
        _buttonItems: [],
        _selectedKey: '',
        _editorLoadedKey: '',

        // Style (global)
        ShowBorder: false,
        BorderColor: '#bfc7d5',
        BorderWidthPx: 1,
        BorderRadiusPx: 6,

        ItemBackground: '#2b2f3a',
        ItemBackgroundHover: '#3a4050',
        ItemTextColor: '#ffffff',
        FontSizePx: 14,
        ItemPaddingYpx: 8,
        ItemPaddingXpx: 10,
        ItemGapPx: 6
      };
    },
    configOptions: function (context, clickedElement, monitorOptions, layoutOptions) {
    monitorOptions.push({
        title: 'Format Navigation Menu',
        mode: 'formatNavigationMenu'
    });
}
  };

  symbolVis.prototype.init = function (scope, elem) {
    this.onDataUpdate = onDataUpdate;
    this.onConfigChange = onConfigChange;

    var container = elem.find('#container')[0];
    container.id = 'navMenu_' + Math.random().toString(36).substr(2, 16);

    var state = { itemsByKey: {} };

    // ---------- helpers ----------
    function safeString(v) {
      if (v === null || v === undefined) return '';
      return ('' + v).trim();
    }

    function clampInt(v, min, max, fallback) {
      var n = parseInt(v, 10);
      if (isNaN(n)) n = fallback;
      if (n < min) n = min;
      if (n > max) n = max;
      return n;
    }

    function sanitizeUrl(raw) {
      var url = safeString(raw);
      if (!url) return '';
      if (/^www\./i.test(url)) url = 'https://' + url;
      return url;
    }

    function getDatasourceList() {
      var s = scope.symbol && scope.symbol.DataSources;
      return Array.isArray(s) ? s.slice() : [];
    }

    function extractFromAfPath(pathOrKey) {
      // Supports:
      // af:\...\Element?GUID|URL?GUID
      // af:\...\Element|URL:GUID
      // Element|URL
      var s = safeString(pathOrKey);
      if (!s) return { element: '', attribute: '' };

      if (s.indexOf('|') >= 0 && s.indexOf('\\') < 0) {
        var p = s.split('|');
        var e0 = safeString(p[0] || '');
        var a0 = safeString(p[1] || '');
        e0 = safeString(e0.split('?')[0].split(':')[0]);
        a0 = safeString(a0.split('?')[0].split(':')[0]);
        return { element: e0, attribute: a0 };
      }

      var segs = s.split('\\');
      var last = segs[segs.length - 1] || s;

      var pipe = last.split('|');
      var element = safeString(pipe[0] || '');
      var attribute = safeString(pipe.length > 1 ? pipe[1] : '');

      element = safeString(element.split('?')[0].split(':')[0]);
      attribute = safeString(attribute.split('?')[0].split(':')[0]);

      return { element: element, attribute: attribute };
    }

    function normalizeKey(pathOrKey) {
      var p = extractFromAfPath(pathOrKey);
      var e = safeString(p.element);
      var a = safeString(p.attribute);
      return (e || a) ? (e + '|' + a) : safeString(pathOrKey);
    }

    function ensureMaps() {
      if (!scope.config.ButtonLabelSettings) scope.config.ButtonLabelSettings = {};
      if (!scope.config.ButtonIconSettings) scope.config.ButtonIconSettings = {};
    }

    function createDefaultLabelSettings() {
      return { LabelMode: '__DEFAULT__', CustomLabel: '' };
    }

    function createDefaultIconSettings() {
      return { IconType: 'None', IconSizePx: clampInt(scope.config.IconSizePx, 12, 48, 18) };
    }

    function ensureEditorState() {
      if (scope.config.ButtonEditorLabelMode === undefined || scope.config.ButtonEditorLabelMode === null) {
        scope.config.ButtonEditorLabelMode = '__DEFAULT__';
      }
      if (scope.config.ButtonEditorCustomLabel === undefined || scope.config.ButtonEditorCustomLabel === null) {
        scope.config.ButtonEditorCustomLabel = '';
      }
      if (scope.config.ButtonEditorIconType === undefined || scope.config.ButtonEditorIconType === null) {
        scope.config.ButtonEditorIconType = 'None';
      }
      if (scope.config.ButtonEditorIconSizeInput === undefined || scope.config.ButtonEditorIconSizeInput === null) {
        scope.config.ButtonEditorIconSizeInput = '' + clampInt(scope.config.IconSizePx, 12, 48, 18);
      }
      scope.config.SaveSelectedButtonTrigger = parseInt(scope.config.SaveSelectedButtonTrigger || 0, 10);
    }

    function getPerButtonLabelSettings(key) {
      ensureMaps();
      return scope.config.ButtonLabelSettings[key] || null;
    }

    function getPerButtonIconSettings(key) {
      ensureMaps();
      return scope.config.ButtonIconSettings[key] || null;
    }

    function computeLabel(key, sourcePathForFallback) {
      var globalMode = scope.config.DefaultLabelMode || 'ElementAttribute';
      var settings = getPerButtonLabelSettings(key);

      var mode = globalMode;
      if (settings && settings.LabelMode && settings.LabelMode !== '__DEFAULT__') {
        mode = settings.LabelMode;
      }

      if (mode === 'None') return ''; // <- NEW

      var parts = extractFromAfPath(sourcePathForFallback || key);

      if (mode === 'Custom') {
        var custom = settings ? safeString(settings.CustomLabel) : '';
        return custom || '';
      }
      if (mode === 'Element') return parts.element || parts.attribute || '';
      if (mode === 'Attribute') return parts.attribute || parts.element || '';

      if (parts.element && parts.attribute) return parts.element + ' - ' + parts.attribute;
      return parts.element || parts.attribute || '';
    }

    function syncDatasourcesToConfig() {
      var ds = getDatasourceList();
      ensureMaps();

      scope.config._datasourceList = ds;
      scope.config._buttonItems = ds.map(function (path, idx) {
        return {
          index: idx,
          name: 'Button ' + (idx + 1),
          path: path,
          key: normalizeKey(path)
        };
      });

      // Default selection (Button 1)
      if (scope.config.SelectedButtonIndex === undefined || scope.config.SelectedButtonIndex === null) {
        scope.config.SelectedButtonIndex = 0;
      }
      if (scope.config.SelectedButtonIndex < 0) scope.config.SelectedButtonIndex = 0;
      if (scope.config.SelectedButtonIndex >= ds.length) scope.config.SelectedButtonIndex = 0;

      if (scope.config._buttonItems.length) {
        var idx = scope.config.SelectedButtonIndex;
        scope.config._selectedKey = scope.config._buttonItems[idx].key;

        // Ensure objects exist for this key
        if (!scope.config.ButtonLabelSettings[scope.config._selectedKey]) {
          scope.config.ButtonLabelSettings[scope.config._selectedKey] = createDefaultLabelSettings();
        }
        if (!scope.config.ButtonIconSettings[scope.config._selectedKey]) {
          scope.config.ButtonIconSettings[scope.config._selectedKey] = createDefaultIconSettings();
        }
      } else {
        scope.config._selectedKey = '';
      }

      scope.config.IconSizePx = clampInt(scope.config.IconSizePx, 12, 48, 18);
      ensureEditorState();
    }

    function loadSelectedButtonIntoEditor(forceReload) {
      var key = safeString(scope.config._selectedKey);

      if (!key) {
        ensureEditorState();
        scope.config.ButtonEditorLabelMode = '__DEFAULT__';
        scope.config.ButtonEditorCustomLabel = '';
        scope.config.ButtonEditorIconType = 'None';
        scope.config.ButtonEditorIconSizeInput = '' + clampInt(scope.config.IconSizePx, 12, 48, 18);
        scope.config._editorLoadedKey = '';
        return;
      }

      if (!forceReload && scope.config._editorLoadedKey === key) {
        return;
      }

      ensureMaps();

      var labelSettings = getPerButtonLabelSettings(key) || createDefaultLabelSettings();
      var iconSettings = getPerButtonIconSettings(key) || createDefaultIconSettings();

      ensureEditorState();
      scope.config.ButtonEditorLabelMode = labelSettings.LabelMode || '__DEFAULT__';
      scope.config.ButtonEditorCustomLabel = safeString(labelSettings.CustomLabel);
      scope.config.ButtonEditorIconType = iconSettings.IconType || 'None';
      scope.config.ButtonEditorIconSizeInput = '' + clampInt(iconSettings.IconSizePx, 12, 48, scope.config.IconSizePx);
      scope.config._editorLoadedKey = key;
    }

    function parseSavedIconSize(rawValue, fallbackValue) {
      var raw = safeString(rawValue);
      var fallback = clampInt(fallbackValue, 12, 48, 18);

      if (!raw) return fallback;
      if (!/^\d+$/.test(raw)) return fallback;

      var parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed < 0) return fallback;
      if (parsed < 12) return 12;
      if (parsed > 48) return 48;
      return parsed;
    }

    function saveEditorIntoSelectedButton() {
      var key = safeString(scope.config._selectedKey);
      if (!key) return;

      ensureMaps();
      ensureEditorState();

      var currentIconSettings = getPerButtonIconSettings(key) || createDefaultIconSettings();
      var savedIconSize = parseSavedIconSize(scope.config.ButtonEditorIconSizeInput, currentIconSettings.IconSizePx);

      scope.config.ButtonLabelSettings[key] = {
        LabelMode: scope.config.ButtonEditorLabelMode || '__DEFAULT__',
        CustomLabel: safeString(scope.config.ButtonEditorCustomLabel)
      };

      scope.config.ButtonIconSettings[key] = {
        IconType: scope.config.ButtonEditorIconType || 'None',
        IconSizePx: savedIconSize
      };

      scope.config.ButtonEditorIconSizeInput = '' + savedIconSize;
      scope.config._editorLoadedKey = key;
    }

    function shouldKeep(item) {
      if (!scope.config.HideBadOrEmpty) return true;
      return item.isGood && !!safeString(item.url);
    }

    function applyContainerStyle() {
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.boxSizing = 'border-box';
      container.style.overflow = 'auto';

      if (scope.config.ShowBorder) {
        container.style.borderStyle = 'solid';
        container.style.borderColor = scope.config.BorderColor;
        container.style.borderWidth = (scope.config.BorderWidthPx || 1) + 'px';
        container.style.borderRadius = (scope.config.BorderRadiusPx || 0) + 'px';
      } else {
        container.style.border = 'none';
      }

      container.style.display = 'flex';
      container.style.flexDirection = (scope.config.Orientation === 'Horizontal') ? 'row' : 'column';
      container.style.alignItems = 'stretch';
      container.style.gap = (scope.config.ItemGapPx || 0) + 'px';
      container.style.padding = (scope.config.ItemGapPx || 0) + 'px';
    }

    function clearContainer() {
      while (container.firstChild) container.removeChild(container.firstChild);
    }

    // ---------- icons (industrial) ----------
    function svgEl(tag) {
      return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

    function makeSvg(sizePx, fillColor, pathD) {
      var s = svgEl('svg');
      s.setAttribute('viewBox', '0 0 24 24');
      s.setAttribute('width', sizePx);
      s.setAttribute('height', sizePx);
      s.style.display = 'inline-block';
      s.style.verticalAlign = 'middle';
      s.style.flex = '0 0 auto';

      var p = svgEl('path');
      p.setAttribute('fill', fillColor);
      p.setAttribute('d', pathD);
      s.appendChild(p);
      return s;
    }

    // Simple, generic “industrial” set (filled icons)
    var ICON_PATHS = {
      Home:    'M12 3l9 8h-3v10h-5v-6H11v6H6V11H3l9-8z',
      Factory: 'M3 21V9l6 3V9l6 3V9l9 4v8H3zm3-2h2v-2H6v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2z',
      Gear:    'M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58-1.92-3.32-2.39.96c-.5-.38-1.04-.69-1.64-.9L14.96 2h-3.92l-.36 2.22c-.6.21-1.14.52-1.64.9l-2.39-.96-1.92 3.32 2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L4.73 14.52l1.92 3.32 2.39-.96c.5.38 1.04.69 1.64.9L11.04 22h3.92l.36-2.22c.6-.21 1.14-.52 1.64-.9l2.39.96 1.92-3.32-2.03-1.58zM13 12a1 1 0 10-2 0 1 1 0 002 0z',
      Pump:    'M7 7h10v4h2v10h-4v-4H9v4H5V11h2V7zm2 2v6h6V9H9z',
      Valve:   'M7 7h10v2h-2v4.17l2 1.15V17h-2v2H9v-2H7v-2.68l2-1.15V9H7V7zm4 2v3.42L9 13.57V15h6v-1.43l-2-1.15V9h-2z',
      Tank:    'M7 3h10v3c0 1.66-2.24 3-5 3S7 7.66 7 6V3zm0 8h10v10H7V11zm2 2v2h6v-2H9zm0 4v2h6v-2H9z',
      Chart:   'M5 19V5h2v12h12v2H5zm4-2V9h2v8H9zm4 0V7h2v10h-2zm4 0v-6h2v6h-2z',
      Wrench:  'M22 19.59l-6.3-6.3a5.5 5.5 0 01-7.4-7.4l3.1 3.1 2.1-2.1-3.1-3.1a5.5 5.5 0 017.4 7.4l6.3 6.3L22 19.59z'
    };

    function makeIconNode(iconType, sizePx) {
      var size = clampInt(sizePx, 12, 48, 18);
      var color = scope.config.ItemTextColor || '#ffffff';

      if (!iconType || iconType === 'None') return null;

      var d = ICON_PATHS[iconType];
      if (!d) return null;

      return makeSvg(size, color, d);
    }

    // ---------- navigation ----------
    function handleNavigate(url) {
      var mode = scope.config.OpenMode || 'SameTab';
      if (!url) return;

      if (mode === 'NewTab') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (mode === 'Popup') {
        var w = clampInt(scope.config.PopupWidth, 200, 3000, 1200);
        var h = clampInt(scope.config.PopupHeight, 200, 2000, 800);
        var opts = 'noopener,noreferrer,width=' + w + ',height=' + h + ',resizable=yes,scrollbars=yes';
        window.open(url, '_blank', opts);
        return;
      }

      // Same tab
      window.location.href = url;
    }

    // ---------- render ----------
    function render() {
      clearContainer();
      applyContainerStyle();

      var dsList = scope.config._datasourceList || getDatasourceList();
      var items = Object.keys(state.itemsByKey).map(function (k) { return state.itemsByKey[k]; });

      items.forEach(function (it) {
        var i = dsList.indexOf(it.sourcePath);
        it.order = (i >= 0) ? i : 9999;
      });

      items = items.filter(shouldKeep);

      if ((scope.config.SortMode || 'AsAdded') === 'LabelAsc') {
        items.sort(function (a, b) { return a.label.localeCompare(b.label); });
      } else {
        items.sort(function (a, b) { return a.order - b.order; });
      }

      if (!items.length) {
        var empty = document.createElement('div');
        empty.textContent = 'No links (bind Static AF Attributes containing URL strings).';
        empty.style.fontSize = (scope.config.FontSizePx || 14) + 'px';
        empty.style.opacity = '0.8';
        empty.style.padding = '8px';
        container.appendChild(empty);
        return;
      }

      items.forEach(function (item) {
        var btn = document.createElement('div');
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = (scope.config.Orientation === 'Horizontal') ? 'center' : 'flex-start';

        // fixed gap (since you want to remove Icon gap option)
        btn.style.gap = '8px';

        btn.style.background = scope.config.ItemBackground;
        btn.style.color = scope.config.ItemTextColor;
        btn.style.fontSize = (scope.config.FontSizePx || 14) + 'px';
        btn.style.padding =
          (scope.config.ItemPaddingYpx || 8) + 'px ' +
          (scope.config.ItemPaddingXpx || 10) + 'px';

        btn.style.borderRadius = Math.max(0, (scope.config.BorderRadiusPx || 0) - 2) + 'px';
        btn.style.boxSizing = 'border-box';
        btn.style.cursor = item.url ? 'pointer' : 'default';
        btn.style.userSelect = 'none';

        btn.style.whiteSpace = 'nowrap';
        btn.style.overflow = 'hidden';

        // icon (per-button)
        var iconSettings = getPerButtonIconSettings(item.key);
        var iconType = iconSettings ? (iconSettings.IconType || 'None') : 'None';
        var iconSize = iconSettings ? iconSettings.IconSizePx : scope.config.IconSizePx;
        var iconNode = makeIconNode(iconType, iconSize);
        if (iconNode) btn.appendChild(iconNode);

        // label (possibly blank if mode None)
        var labelText = safeString(item.label);
        if (labelText) {
          var label = document.createElement('div');
          label.textContent = labelText;
          label.style.flex = '1 1 auto';
          label.style.overflow = 'hidden';
          label.style.textOverflow = 'ellipsis';
          btn.appendChild(label);
        } else {
          // If no label, keep the button clickable with just icon
          // Add a little min width so it doesn’t collapse too much
          btn.style.minHeight = '28px';
        }

        btn.addEventListener('mouseenter', function () { btn.style.background = scope.config.ItemBackgroundHover; });
        btn.addEventListener('mouseleave', function () { btn.style.background = scope.config.ItemBackground; });

        btn.addEventListener('click', function () {
          if (!item.url) return;
          handleNavigate(item.url);
        });

        if (scope.config.Orientation === 'Horizontal') {
          btn.style.flex = '1 1 auto';
          btn.style.minWidth = '80px';
        }

        container.appendChild(btn);
      });
    }

    // ---------- data wiring ----------
    function upsert(sourcePath, url, isGood) {
      var key = normalizeKey(sourcePath);

      state.itemsByKey[key] = {
        key: key,
        sourcePath: sourcePath,
        label: computeLabel(key, sourcePath),
        url: sanitizeUrl(url),
        isGood: (isGood !== false),
        order: 9999
      };
    }

    function onDataUpdate(data) {
      syncDatasourcesToConfig();
      loadSelectedButtonIntoEditor(false);

      var rows = null;
      if (data && Array.isArray(data.Rows)) rows = data.Rows;
      else if (data && Array.isArray(data.Data)) rows = data.Data;
      if (!rows) return;

      // Some PI Vision builds don't include path in table rows -> map by index
      var ds = scope.config._datasourceList || getDatasourceList();

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r) continue;

        var path = safeString(r.Path || r.PathName || r.Name || '');
        if (!path && r.Label) path = safeString(r.Label);
        if (!path && i < ds.length) path = ds[i];

        var rawVal = (r.Value && r.Value.Value !== undefined) ? r.Value.Value : r.Value;
        if (!path) continue;

        upsert(path, rawVal, r.IsGood);
      }

      render();
    }

    function onConfigChange() {
      syncDatasourcesToConfig();
      loadSelectedButtonIntoEditor(false);

      Object.keys(state.itemsByKey).forEach(function (k) {
        var it = state.itemsByKey[k];
        it.label = computeLabel(it.key, it.sourcePath);
      });

      render();
    }

    // Deep watch: apply per-button changes reliably
    var guard = false;
    function applyFromWatch() {
      if (guard) return;
      guard = true;
      try { onConfigChange(); } finally { guard = false; }
    }

    scope.$watch('config.ButtonLabelSettings', function (n, o) { if (n !== o) applyFromWatch(); }, true);
    scope.$watch('config.ButtonIconSettings', function (n, o) { if (n !== o) applyFromWatch(); }, true);

    scope.$watch('config.DefaultLabelMode', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.OpenMode', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.Orientation', function (n, o) { if (n !== o) applyFromWatch(); });

    scope.$watch('config.ItemBackground', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.ItemBackgroundHover', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.ItemTextColor', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.FontSizePx', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.ItemPaddingYpx', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.ItemPaddingXpx', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.IconSizePx', function (n, o) { if (n !== o) applyFromWatch(); });
    scope.$watch('config.SelectedButtonIndex', function (n, o) {
      if (n !== o) loadSelectedButtonIntoEditor(true);
    });
    scope.$watch('config.SaveSelectedButtonTrigger', function (n, o) {
      if (n !== o) {
        saveEditorIntoSelectedButton();
        applyFromWatch();
      }
    });

    // Initial
    syncDatasourcesToConfig();
    loadSelectedButtonIntoEditor(true);
  };

  PV.symbolCatalog.register(definition);

})(window.PIVisualization);
