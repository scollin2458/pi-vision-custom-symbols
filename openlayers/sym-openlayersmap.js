(function (PV) {
    'use strict';

    function symbolVis() {}
    PV.deriveVisualizationFromBase(symbolVis);

    var ALL_MARKERS_SELECTED = -2;
    var MARKER_DOT_OFFSET_Y = -18;

    var definition = {
        typeName: 'openlayersmap',
        displayName: 'OpenLayers Map',
        iconUrl: '/Scripts/app/editor/symbols/ext/Icons/openlayersmap.svg',
        datasourceBehavior: PV.Extensibility.Enums.DatasourceBehaviors.Single,
        visObjectType: symbolVis,
        getDefaultConfig: function () {
            return {
                DataShape: 'Value',
                Height: 400,
                Width: 600,

                CenterLon: -73.5,
                CenterLat: 45.5,
                Zoom: 5,
                MinZoom: 2,
                MaxZoom: 18,

                EnableMarkers: true,
                Markers: [],
                SelectedMarkerIndex: -1,

                ShowZoomControl: true,
                ShowAttribution: true,
                LockMap: false,

                MarkerIconUrl: '/PIVision/Content/openlayers/map-pin-red.svg',
                MarkerScale: 1.0,
                SelectedMarkerScale: 1.15,

                OpenLayersJsUrl: '/PIVision/Content/openlayers/ol.js',
                OpenLayersCssUrl: '/PIVision/Content/openlayers/ol.css',

                UseCurrentViewTrigger: 0,
                DeleteSelectedMarkerTrigger: 0,
                ToggleSelectAllMarkersTrigger: 0,
                SaveSelectedMarkerTrigger: 0,
                SaveLabelPositionsTrigger: 0,
                ResetLabelPositionsTrigger: 0,

                MarkerEditTitle: '',
                MarkerEditDisplayUrl: '',
                MarkerEditDisplayLabel: '',
                MarkerEditOpenInNewTab: true
            };
        },
        configOptions: function (context, clickedElement, monitorOptions) {
            monitorOptions.push({
                title: 'Format Map',
                mode: 'formatOpenLayersMap'
            });
        }
    };

    symbolVis.prototype.init = function (scope, elem) {
        var map = null;
        var vectorSource = null;
        var mapContainer = null;
        var lockBadgeElement = null;
        var leaderLinesSvg = null;
        var labelLayer = null;

        var labelPlacements = {};
        var draggedLabelDirty = false;

        var uniqueId = 'openlayersmap_' + Math.random().toString(36).substr(2, 16);
        var cssLoadedKey = '__piVisionOpenLayersCssLoaded__';
        var jsLoadedKey = '__piVisionOpenLayersJsLoading__';

        this.onDataUpdate = onDataUpdate;
        this.onConfigChange = onConfigChange;
        this.onResize = onResize;

        function safeNumber(value, fallback) {
            var n = parseFloat(value);
            return isNaN(n) ? fallback : n;
        }

        function ensureArray(value) {
            return Array.isArray(value) ? value : [];
        }

        function defaultLinkLabel(url) {
            if (!url) {
                return '';
            }

            try {
                var cleanUrl = url.split('?')[0].split('#')[0];
                var parts = cleanUrl.split('/').filter(function (p) { return !!p; });
                if (!parts.length) {
                    return url;
                }
                return decodeURIComponent(parts[parts.length - 1]);
            } catch (e) {
                return url;
            }
        }

        function ensureConfig() {
            scope.config.CenterLon = safeNumber(scope.config.CenterLon, -73.5);
            scope.config.CenterLat = safeNumber(scope.config.CenterLat, 45.5);
            scope.config.Zoom = safeNumber(scope.config.Zoom, 5);
            scope.config.MinZoom = safeNumber(scope.config.MinZoom, 2);
            scope.config.MaxZoom = safeNumber(scope.config.MaxZoom, 18);

            scope.config.EnableMarkers = scope.config.EnableMarkers !== false;
            scope.config.ShowZoomControl = scope.config.ShowZoomControl !== false;
            scope.config.ShowAttribution = scope.config.ShowAttribution !== false;
            scope.config.LockMap = scope.config.LockMap === true;

            scope.config.Markers = ensureArray(scope.config.Markers);

            if (typeof scope.config.SelectedMarkerIndex !== 'number') {
                scope.config.SelectedMarkerIndex = -1;
            }

            scope.config.UseCurrentViewTrigger = parseInt(scope.config.UseCurrentViewTrigger || 0, 10);
            scope.config.DeleteSelectedMarkerTrigger = parseInt(scope.config.DeleteSelectedMarkerTrigger || 0, 10);
            scope.config.ToggleSelectAllMarkersTrigger = parseInt(scope.config.ToggleSelectAllMarkersTrigger || 0, 10);
            scope.config.SaveSelectedMarkerTrigger = parseInt(scope.config.SaveSelectedMarkerTrigger || 0, 10);
            scope.config.SaveLabelPositionsTrigger = parseInt(scope.config.SaveLabelPositionsTrigger || 0, 10);
            scope.config.ResetLabelPositionsTrigger = parseInt(scope.config.ResetLabelPositionsTrigger || 0, 10);

            if (!scope.config.MarkerIconUrl) {
                scope.config.MarkerIconUrl = '/PIVision/Content/openlayers/map-pin-red.svg';
            }
            if (!scope.config.MarkerScale) {
                scope.config.MarkerScale = 1.0;
            }
            if (!scope.config.SelectedMarkerScale) {
                scope.config.SelectedMarkerScale = 1.15;
            }
            if (!scope.config.OpenLayersJsUrl) {
                scope.config.OpenLayersJsUrl = '/PIVision/Content/openlayers/ol.js';
            }
            if (!scope.config.OpenLayersCssUrl) {
                scope.config.OpenLayersCssUrl = '/PIVision/Content/openlayers/ol.css';
            }

            if (scope.config.MarkerEditTitle === undefined || scope.config.MarkerEditTitle === null) {
                scope.config.MarkerEditTitle = '';
            }
            if (scope.config.MarkerEditDisplayUrl === undefined || scope.config.MarkerEditDisplayUrl === null) {
                scope.config.MarkerEditDisplayUrl = '';
            }
            if (scope.config.MarkerEditDisplayLabel === undefined || scope.config.MarkerEditDisplayLabel === null) {
                scope.config.MarkerEditDisplayLabel = '';
            }
            scope.config.MarkerEditOpenInNewTab = scope.config.MarkerEditOpenInNewTab !== false;
            scope.config.MarkerEditHidePopupTitle = scope.config.MarkerEditHidePopupTitle === true;

            for (var i = 0; i < scope.config.Markers.length; i++) {
                var m = scope.config.Markers[i];

                if (m.title === undefined || m.title === null) {
                    m.title = '';
                }
                if (!m.displayUrl) {
                    m.displayUrl = '';
                }
                if (m.displayLabel === undefined || m.displayLabel === null) {
                    m.displayLabel = '';
                }
                if (m.openInNewTab === undefined || m.openInNewTab === null) {
                    m.openInNewTab = true;
                }
                if (m.hidePopupTitle === undefined || m.hidePopupTitle === null) {
                    m.hidePopupTitle = false;
                } else {
                    m.hidePopupTitle = !!m.hidePopupTitle;
                }

                if (m.labelOffsetX === undefined || m.labelOffsetX === null || isNaN(parseFloat(m.labelOffsetX))) {
                    m.labelOffsetX = 0;
                }
                if (m.labelOffsetY === undefined || m.labelOffsetY === null || isNaN(parseFloat(m.labelOffsetY))) {
                    m.labelOffsetY = 0;
                }
                m.labelOffsetX = safeNumber(m.labelOffsetX, 0);
                m.labelOffsetY = safeNumber(m.labelOffsetY, 0);

                if (m.labelPositionSaved === undefined || m.labelPositionSaved === null) {
                    m.labelPositionSaved = false;
                } else {
                    m.labelPositionSaved = !!m.labelPositionSaved;
                }
            }

            if (scope.config.SelectedMarkerIndex >= scope.config.Markers.length) {
                scope.config.SelectedMarkerIndex = -1;
            }
            if (scope.config.Markers.length === 0 && scope.config.SelectedMarkerIndex === ALL_MARKERS_SELECTED) {
                scope.config.SelectedMarkerIndex = -1;
            }
        }

        function loadSelectedMarkerIntoEditor() {
            var idx = scope.config.SelectedMarkerIndex;

            if (idx < 0 || idx >= scope.config.Markers.length) {
                clearEditor();
                return;
            }

            var marker = scope.config.Markers[idx];
            scope.config.MarkerEditTitle = marker.title || '';
            scope.config.MarkerEditDisplayUrl = marker.displayUrl || '';
            scope.config.MarkerEditDisplayLabel = marker.displayLabel || '';
            scope.config.MarkerEditOpenInNewTab = marker.openInNewTab !== false;
            scope.config.MarkerEditHidePopupTitle = marker.hidePopupTitle === true;
        }

        function clearEditor() {
            scope.config.MarkerEditTitle = '';
            scope.config.MarkerEditDisplayUrl = '';
            scope.config.MarkerEditDisplayLabel = '';
            scope.config.MarkerEditOpenInNewTab = true;
            scope.config.MarkerEditHidePopupTitle = false;
        }

        function saveEditorIntoSelectedMarker() {
            var idx = scope.config.SelectedMarkerIndex;

            if (idx < 0 || idx >= scope.config.Markers.length) {
                return;
            }

            var marker = scope.config.Markers[idx];
            marker.title = scope.config.MarkerEditTitle || '';
            marker.displayUrl = scope.config.MarkerEditDisplayUrl || '';
            marker.displayLabel = scope.config.MarkerEditDisplayLabel || '';
            marker.openInNewTab = scope.config.MarkerEditOpenInNewTab !== false;
            marker.hidePopupTitle = scope.config.MarkerEditHidePopupTitle === true;
        }

        function loadCssOnce(url) {
            if (!url || window[cssLoadedKey]) {
                return;
            }

            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;
            document.head.appendChild(link);

            window[cssLoadedKey] = true;
        }

        function loadScriptOnce(url, callback) {
            if (window.ol) {
                callback();
                return;
            }

            if (window[jsLoadedKey]) {
                waitForOpenLayers(callback);
                return;
            }

            window[jsLoadedKey] = true;

            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.onload = function () {
                waitForOpenLayers(callback);
            };
            script.onerror = function () {
                console.error('Failed to load OpenLayers script from local path:', url);
            };

            document.head.appendChild(script);
        }

        function waitForOpenLayers(callback) {
            var retries = 0;
            var maxRetries = 100;

            function check() {
                if (window.ol && window.ol.Map && window.ol.View) {
                    callback();
                    return;
                }

                retries += 1;
                if (retries < maxRetries) {
                    setTimeout(check, 100);
                } else {
                    console.error('OpenLayers was not available after waiting.');
                }
            }

            check();
        }

        function getMapContainer() {
            if (!mapContainer) {
                mapContainer = elem.find('#openlayers-map-host')[0];
                if (mapContainer) {
                    mapContainer.id = uniqueId;
                    mapContainer.style.width = '100%';
                    mapContainer.style.height = '100%';
                    mapContainer.style.minHeight = '100px';
                }
            }
            return mapContainer;
        }

        function getLockBadgeElement() {
            if (!lockBadgeElement) {
                lockBadgeElement = elem.find('#openlayers-lock-badge')[0];
            }
            return lockBadgeElement;
        }

        function getLeaderLinesSvg() {
            if (!leaderLinesSvg) {
                leaderLinesSvg = elem.find('#openlayers-leader-lines')[0];
            }
            return leaderLinesSvg;
        }

        function getLabelLayer() {
            if (!labelLayer) {
                labelLayer = elem.find('#openlayers-label-layer')[0];
            }
            return labelLayer;
        }

        function clearLeaderLines() {
            var svg = getLeaderLinesSvg();
            if (!svg) {
                return;
            }
            while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }
        }

        function clearLabels() {
            var layer = getLabelLayer();
            if (!layer) {
                return;
            }
            while (layer.firstChild) {
                layer.removeChild(layer.firstChild);
            }
            clearLeaderLines();
        }

        function applyLockBadgeVisibility() {
            var badge = getLockBadgeElement();
            if (!badge) {
                return;
            }

            badge.style.display = scope.config.LockMap ? 'flex' : 'none';
        }

        function buildMarkerStyle(isSelected) {
            return new ol.style.Style({
                image: new ol.style.Icon({
                    src: scope.config.MarkerIconUrl,
                    anchor: [0.5, 1.0],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    imgSize: [32, 32],
                    scale: isSelected
                        ? safeNumber(scope.config.SelectedMarkerScale, 1.15)
                        : safeNumber(scope.config.MarkerScale, 1.0)
                })
            });
        }

        function rebuildMarkers() {
            if (!vectorSource || !window.ol) {
                return;
            }

            vectorSource.clear();

            var markers = ensureArray(scope.config.Markers);
            var selectedIndex = scope.config.SelectedMarkerIndex;
            var allSelected = selectedIndex === ALL_MARKERS_SELECTED;

            for (var i = 0; i < markers.length; i++) {
                var marker = markers[i];
                if (marker && marker.lon !== undefined && marker.lat !== undefined) {
                    var feature = new ol.Feature({
                        geometry: new ol.geom.Point(
                            ol.proj.fromLonLat([
                                safeNumber(marker.lon, 0),
                                safeNumber(marker.lat, 0)
                            ])
                        )
                    });

                    feature.set('markerIndex', i);
                    feature.setStyle(buildMarkerStyle(allSelected || i === selectedIndex));
                    vectorSource.addFeature(feature);
                }
            }
        }

        function applyControlVisibility() {
            if (!map || !map.getTargetElement) {
                return;
            }

            var target = map.getTargetElement();
            if (!target) {
                return;
            }

            var zoomEl = target.querySelector('.ol-zoom');
            var attributionEl = target.querySelector('.ol-attribution');

            if (zoomEl) {
                zoomEl.style.display = (scope.config.ShowZoomControl && !scope.config.LockMap) ? '' : 'none';
            }

            if (attributionEl) {
                attributionEl.style.display = scope.config.ShowAttribution ? '' : 'none';
            }
        }

        function applyMapLockState() {
            if (!map) {
                return;
            }

            var interactions = map.getInteractions();
            interactions.forEach(function (interaction) {
                interaction.setActive(!scope.config.LockMap);
            });

            applyControlVisibility();
            applyLockBadgeVisibility();
        }

        function buildPopupHtml(marker) {
            var title = marker.title || 'Marker';
            var html = '';

            if (!marker.hidePopupTitle) {
                html = '<div style="font-weight:bold; margin-bottom:4px;">' + title + '</div>';
            }

            if (marker.displayUrl) {
                var linkLabel = marker.displayLabel || defaultLinkLabel(marker.displayUrl);
                var target = marker.openInNewTab ? '_blank' : '_self';
                var rel = marker.openInNewTab ? ' rel="noopener noreferrer"' : '';

                html += '<div>' +
                    '<a href="' + marker.displayUrl + '" target="' + target + '"' + rel + ' style="color:#0066cc; text-decoration:underline; pointer-events:auto;">' +
                    linkLabel +
                    '</a>' +
                    '</div>';
            } else {
                html += '<div>Lon: ' + safeNumber(marker.lon, 0).toFixed(5) + '</div>' +
                        '<div>Lat: ' + safeNumber(marker.lat, 0).toFixed(5) + '</div>';
            }

            return html;
        }

        function createLabelElement(marker, markerIndex) {
            var labelEl = document.createElement('div');
            labelEl.style.position = 'absolute';
            labelEl.style.minWidth = '160px';
            labelEl.style.background = '#ffffff';
            labelEl.style.border = '1px solid #cccccc';
            labelEl.style.borderRadius = '4px';
            labelEl.style.padding = '8px 10px';
            labelEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
            labelEl.style.pointerEvents = 'auto';
            labelEl.style.zIndex = '10';
            labelEl.style.whiteSpace = 'nowrap';
            labelEl.innerHTML = buildPopupHtml(marker);
            labelEl.setAttribute('data-marker-index', String(markerIndex));
            return labelEl;
        }

        function measureLabel(marker, markerIndex) {
            var layer = getLabelLayer();
            var el = createLabelElement(marker, markerIndex);

            el.style.left = '-10000px';
            el.style.top = '-10000px';
            el.style.visibility = 'hidden';

            layer.appendChild(el);

            var rect = el.getBoundingClientRect();
            var size = {
                width: Math.ceil(rect.width),
                height: Math.ceil(rect.height)
            };

            layer.removeChild(el);
            return size;
        }

        function getMarkerAnchorPoint(markerCoord) {
            var pixel = map.getPixelFromCoordinate(ol.proj.fromLonLat(markerCoord));
            if (!pixel) {
                return null;
            }

            return {
                x: pixel[0],
                y: pixel[1] + MARKER_DOT_OFFSET_Y
            };
        }

        function makeRect(left, top, width, height) {
            return {
                left: left,
                top: top,
                right: left + width,
                bottom: top + height,
                width: width,
                height: height
            };
        }

        function rectsOverlap(a, b, padding) {
            padding = padding || 6;

            return !(
                a.right + padding < b.left ||
                a.left > b.right + padding ||
                a.bottom + padding < b.top ||
                a.top > b.bottom + padding
            );
        }

        function rectIntersectionArea(a, b) {
            var x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            var y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return x * y;
        }

        function closestPointOnRect(px, py, rect) {
            var candidates = [];

            var clampedX = Math.max(rect.left, Math.min(px, rect.right));
            var clampedY = Math.max(rect.top, Math.min(py, rect.bottom));

            candidates.push({ x: clampedX, y: rect.top });
            candidates.push({ x: clampedX, y: rect.bottom });
            candidates.push({ x: rect.left, y: clampedY });
            candidates.push({ x: rect.right, y: clampedY });

            var best = candidates[0];
            var bestDist = Infinity;

            for (var i = 0; i < candidates.length; i++) {
                var dx = candidates[i].x - px;
                var dy = candidates[i].y - py;
                var d2 = dx * dx + dy * dy;
                if (d2 < bestDist) {
                    bestDist = d2;
                    best = candidates[i];
                }
            }

            return best;
        }

        function getViewportRect() {
            if (!mapContainer) {
                return makeRect(0, 0, 0, 0);
            }

            return makeRect(0, 0, mapContainer.clientWidth, mapContainer.clientHeight);
        }

        function getMarkerExclusionRect(anchor) {
            return makeRect(
                anchor.x - 22,
                anchor.y - 34,
                44,
                54
            );
        }

        function getMarkerVerticalCorridorRect(anchor) {
            return makeRect(
                anchor.x - 18,
                anchor.y - 140,
                36,
                140
            );
        }

        function candidateCrossesMarkerStripe(candidateRect, anchor) {
            var stripe = makeRect(
                anchor.x - 26,
                anchor.y - 220,
                52,
                260
            );

            return rectsOverlap(candidateRect, stripe, 0);
        }

        function generateCandidateRects(anchor, size) {
            var w = size.width;
            var h = size.height;

            var gaps = [36, 64, 96, 136, 190, 250];
            var positions = [];

            for (var g = 0; g < gaps.length; g++) {
                var gap = gaps[g];

                positions.push({ left: anchor.x + gap,              top: anchor.y - h - gap, kind: 'top-right' });
                positions.push({ left: anchor.x - w - gap,          top: anchor.y - h - gap, kind: 'top-left' });

                positions.push({ left: anchor.x + gap,              top: anchor.y - h / 2,   kind: 'right' });
                positions.push({ left: anchor.x - w - gap,          top: anchor.y - h / 2,   kind: 'left' });

                positions.push({ left: anchor.x + gap,              top: anchor.y + gap,     kind: 'bottom-right' });
                positions.push({ left: anchor.x - w - gap,          top: anchor.y + gap,     kind: 'bottom-left' });

                positions.push({ left: anchor.x + gap + 60,         top: anchor.y - h / 2,   kind: 'far-right' });
                positions.push({ left: anchor.x - w - gap - 60,     top: anchor.y - h / 2,   kind: 'far-left' });

                positions.push({ left: anchor.x + gap + 90,         top: anchor.y - h - gap, kind: 'far-top-right' });
                positions.push({ left: anchor.x - w - gap - 90,     top: anchor.y - h - gap, kind: 'far-top-left' });
            }

            var rects = [];
            for (var i = 0; i < positions.length; i++) {
                rects.push({
                    rect: makeRect(positions[i].left, positions[i].top, w, h),
                    kind: positions[i].kind
                });
            }

            return rects;
        }

        function getMarkerDensityOrder(markers) {
            var entries = [];
            for (var i = 0; i < markers.length; i++) {
                var anchor = getMarkerAnchorPoint([markers[i].lon, markers[i].lat]);
                if (!anchor) {
                    continue;
                }

                var density = 0;
                for (var j = 0; j < markers.length; j++) {
                    if (i === j) {
                        continue;
                    }
                    var other = getMarkerAnchorPoint([markers[j].lon, markers[j].lat]);
                    if (!other) {
                        continue;
                    }
                    var dx = other.x - anchor.x;
                    var dy = other.y - anchor.y;
                    var d2 = dx * dx + dy * dy;
                    if (d2 < 180 * 180) {
                        density += 1;
                    }
                }

                entries.push({
                    index: i,
                    density: density,
                    anchorY: anchor.y,
                    anchorX: anchor.x
                });
            }

            entries.sort(function (a, b) {
                if (b.density !== a.density) {
                    return b.density - a.density;
                }
                if (a.anchorY !== b.anchorY) {
                    return a.anchorY - b.anchorY;
                }
                return a.anchorX - b.anchorX;
            });

            return entries;
        }

        function scoreCandidate(candidateRect, anchor, viewportRect, placedRects, markerRects, markerCorridorRects) {
            var score = 0;
            var overlapsMarker = false;

            if (candidateCrossesMarkerStripe(candidateRect, anchor)) {
                score += 50000000;
            }

            for (var i = 0; i < placedRects.length; i++) {
                if (rectsOverlap(candidateRect, placedRects[i], 8)) {
                    score += 1000000 + rectIntersectionArea(candidateRect, placedRects[i]) * 100;
                }
            }

            for (var j = 0; j < markerRects.length; j++) {
                if (rectsOverlap(candidateRect, markerRects[j], 8)) {
                    overlapsMarker = true;
                    score += 10000000 + rectIntersectionArea(candidateRect, markerRects[j]) * 500;
                }
            }

            for (var k = 0; k < markerCorridorRects.length; k++) {
                if (rectsOverlap(candidateRect, markerCorridorRects[k], 4)) {
                    score += 2000000 + rectIntersectionArea(candidateRect, markerCorridorRects[k]) * 160;
                }
            }

            if (candidateRect.left < viewportRect.left) {
                score += (viewportRect.left - candidateRect.left) * 2000;
            }
            if (candidateRect.right > viewportRect.right) {
                score += (candidateRect.right - viewportRect.right) * 2000;
            }
            if (candidateRect.top < viewportRect.top) {
                score += (viewportRect.top - candidateRect.top) * 2000;
            }
            if (candidateRect.bottom > viewportRect.bottom) {
                score += (candidateRect.bottom - viewportRect.bottom) * 2000;
            }

            var nearest = closestPointOnRect(anchor.x, anchor.y, candidateRect);
            var dx = nearest.x - anchor.x;
            var dy = nearest.y - anchor.y;
            score += (dx * dx + dy * dy);

            var centerY = (candidateRect.top + candidateRect.bottom) / 2;
            if (centerY > anchor.y) {
                score += 7000;
            }

            return {
                score: score,
                overlapsMarker: overlapsMarker
            };
        }

        function drawLeaderLine(startPt, endPt) {
            var svg = getLeaderLinesSvg();
            if (!svg) {
                return;
            }

            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', startPt.x);
            line.setAttribute('y1', startPt.y);
            line.setAttribute('x2', endPt.x);
            line.setAttribute('y2', endPt.y);
            line.setAttribute('stroke', '#d62828');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-linecap', 'round');

            svg.appendChild(line);
        }

        function attachLabelDrag(labelEl, markerIndex) {
            labelEl.addEventListener('mousedown', function (evt) {
                if (scope.config.SelectedMarkerIndex !== ALL_MARKERS_SELECTED) {
                    return;
                }
                if (scope.config.LockMap) {
                    return;
                }

                evt.preventDefault();
                evt.stopPropagation();

                var startMouseX = evt.clientX;
                var startMouseY = evt.clientY;
                var startLeft = parseFloat(labelEl.style.left) || 0;
                var startTop = parseFloat(labelEl.style.top) || 0;

                function onMove(moveEvt) {
                    var dx = moveEvt.clientX - startMouseX;
                    var dy = moveEvt.clientY - startMouseY;

                    labelEl.style.left = (startLeft + dx) + 'px';
                    labelEl.style.top = (startTop + dy) + 'px';

                    if (!labelPlacements[markerIndex]) {
                        labelPlacements[markerIndex] = {};
                    }
                    labelPlacements[markerIndex].rect = makeRect(
                        startLeft + dx,
                        startTop + dy,
                        labelEl.offsetWidth,
                        labelEl.offsetHeight
                    );
                    labelPlacements[markerIndex].moved = true;
                    labelPlacements[markerIndex].dragged = true;
                    draggedLabelDirty = true;

                    redrawLeaderLinesFromCurrentLabels();
                }

                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }

        function redrawLeaderLinesFromCurrentLabels() {
            clearLeaderLines();

            if (scope.config.SelectedMarkerIndex !== ALL_MARKERS_SELECTED) {
                return;
            }

            for (var key in labelPlacements) {
                if (!Object.prototype.hasOwnProperty.call(labelPlacements, key)) {
                    continue;
                }

                var info = labelPlacements[key];
                if (!info || !info.rect || !info.anchor || !info.moved) {
                    continue;
                }

                var endPoint = closestPointOnRect(
                    info.anchor.x,
                    info.anchor.y,
                    info.rect
                );

                drawLeaderLine(
                    { x: info.anchor.x, y: info.anchor.y },
                    { x: endPoint.x, y: endPoint.y }
                );
            }
        }

        function saveLabelPositionsToMarkers() {
            for (var i = 0; i < scope.config.Markers.length; i++) {
                var marker = scope.config.Markers[i];
                var placement = labelPlacements[i];

                if (!placement || !placement.rect || !placement.anchor) {
                    continue;
                }

                marker.labelOffsetX = placement.rect.left - placement.anchor.x;
                marker.labelOffsetY = placement.rect.top - placement.anchor.y;
                marker.labelPositionSaved = true;
            }

            draggedLabelDirty = false;
        }

        function resetAllLabelPositions() {
            for (var i = 0; i < scope.config.Markers.length; i++) {
                scope.config.Markers[i].labelOffsetX = 0;
                scope.config.Markers[i].labelOffsetY = 0;
                scope.config.Markers[i].labelPositionSaved = false;
            }

            labelPlacements = {};
            draggedLabelDirty = false;
        }

        function renderSingleSelectedLabel(marker, markerIndex) {
            clearLabels();
            labelPlacements = {};

            var layer = getLabelLayer();
            var anchor = getMarkerAnchorPoint([marker.lon, marker.lat]);
            if (!layer || !anchor) {
                return;
            }

            var el = createLabelElement(marker, markerIndex);
            var size = measureLabel(marker, markerIndex);
            var rect = makeRect(anchor.x - size.width / 2, anchor.y - size.height - 24, size.width, size.height);
            var viewport = getViewportRect();

            if (rect.left < viewport.left) {
                rect.left = viewport.left + 4;
                rect.right = rect.left + rect.width;
            }
            if (rect.right > viewport.right) {
                rect.left = viewport.right - rect.width - 4;
                rect.right = rect.left + rect.width;
            }
            if (rect.top < viewport.top) {
                rect.top = viewport.top + 4;
                rect.bottom = rect.top + rect.height;
            }

            el.style.left = rect.left + 'px';
            el.style.top = rect.top + 'px';
            layer.appendChild(el);
        }

        function renderAllSelectedLabels(markers) {
            clearLabels();
            labelPlacements = {};

            var layer = getLabelLayer();
            if (!layer || !markers.length) {
                return;
            }

            var viewport = getViewportRect();
            var placedRects = [];
            var markerRects = [];
            var markerCorridorRects = [];
            var placements = [];
            var markerAnchors = [];

            for (var m = 0; m < markers.length; m++) {
                var mAnchor = getMarkerAnchorPoint([markers[m].lon, markers[m].lat]);
                if (mAnchor) {
                    markerAnchors[m] = mAnchor;
                    markerRects.push(getMarkerExclusionRect(mAnchor));
                    markerCorridorRects.push(getMarkerVerticalCorridorRect(mAnchor));
                }
            }

            var order = getMarkerDensityOrder(markers);

            for (var o = 0; o < order.length; o++) {
                var idx = order[o].index;
                var marker = markers[idx];
                var anchor = markerAnchors[idx];
                if (!anchor) {
                    continue;
                }

                var size = measureLabel(marker, idx);

                if (marker.labelPositionSaved) {
                    var savedRect = makeRect(
                        anchor.x + safeNumber(marker.labelOffsetX, 0),
                        anchor.y + safeNumber(marker.labelOffsetY, 0),
                        size.width,
                        size.height
                    );

                    placedRects.push(savedRect);
                    placements.push({
                        markerIndex: idx,
                        marker: marker,
                        anchor: anchor,
                        rect: savedRect,
                        moved: !(safeNumber(marker.labelOffsetX, 0) === 0 && safeNumber(marker.labelOffsetY, 0) === -size.height - 24)
                    });
                    continue;
                }

                var candidates = generateCandidateRects(anchor, size);

                var bestNoMarkerOverlap = null;
                var bestNoMarkerOverlapScore = Infinity;

                var bestFallback = null;
                var bestFallbackScore = Infinity;

                for (var c = 0; c < candidates.length; c++) {
                    var result = scoreCandidate(
                        candidates[c].rect,
                        anchor,
                        viewport,
                        placedRects,
                        markerRects,
                        markerCorridorRects
                    );

                    if (!result.overlapsMarker && result.score < bestNoMarkerOverlapScore) {
                        bestNoMarkerOverlapScore = result.score;
                        bestNoMarkerOverlap = candidates[c];
                    }

                    if (result.score < bestFallbackScore) {
                        bestFallbackScore = result.score;
                        bestFallback = candidates[c];
                    }
                }

                var best = bestNoMarkerOverlap || bestFallback;

                if (!best) {
                    best = {
                        rect: makeRect(anchor.x - size.width / 2, anchor.y - size.height - 36, size.width, size.height),
                        kind: 'top-left'
                    };
                }

                placedRects.push(best.rect);
                placements.push({
                    markerIndex: idx,
                    marker: marker,
                    anchor: anchor,
                    rect: best.rect,
                    moved: true
                });
            }

            for (var p = 0; p < placements.length; p++) {
                var placement = placements[p];
                var el = createLabelElement(placement.marker, placement.markerIndex);
                el.style.left = placement.rect.left + 'px';
                el.style.top = placement.rect.top + 'px';
                layer.appendChild(el);

                labelPlacements[placement.markerIndex] = {
                    anchor: placement.anchor,
                    rect: placement.rect,
                    moved: placement.moved,
                    dragged: false,
                    element: el
                };

                attachLabelDrag(el, placement.markerIndex);
            }

            redrawLeaderLinesFromCurrentLabels();
        }

        function renderVisiblePopups() {
            if (!map || !window.ol) {
                return;
            }

            var markers = ensureArray(scope.config.Markers);
            var selectedIndex = scope.config.SelectedMarkerIndex;

            if (selectedIndex === ALL_MARKERS_SELECTED) {
                renderAllSelectedLabels(markers);
                return;
            }

            if (selectedIndex >= 0 && selectedIndex < markers.length) {
                renderSingleSelectedLabel(markers[selectedIndex], selectedIndex);
                return;
            }

            clearLabels();
            labelPlacements = {};
        }

        function saveCurrentViewAsDefault() {
            if (!map || !window.ol) {
                return;
            }

            var view = map.getView();
            var center = view.getCenter();
            var lonLat = ol.proj.toLonLat(center);

            scope.config.CenterLon = lonLat[0];
            scope.config.CenterLat = lonLat[1];
            scope.config.Zoom = view.getZoom();
        }

        function deleteSelectedMarker() {
            ensureConfig();

            var idx = scope.config.SelectedMarkerIndex;
            if (idx < 0 || idx >= scope.config.Markers.length) {
                return;
            }

            scope.config.Markers.splice(idx, 1);
            scope.config.SelectedMarkerIndex = -1;
            clearEditor();
        }

        function toggleSelectAllMarkers() {
            ensureConfig();

            if (!scope.config.Markers || scope.config.Markers.length === 0) {
                scope.config.SelectedMarkerIndex = -1;
                clearEditor();
                return;
            }

            if (scope.config.SelectedMarkerIndex === ALL_MARKERS_SELECTED) {
                scope.config.SelectedMarkerIndex = -1;
                clearEditor();
            } else {
                scope.config.SelectedMarkerIndex = ALL_MARKERS_SELECTED;
                clearEditor();
            }
        }

        function createMap() {
            if (!window.ol || map) {
                return;
            }

            var target = getMapContainer();
            if (!target) {
                return;
            }

            vectorSource = new ol.source.Vector({});

            map = new ol.Map({
                target: target,
                layers: [
                    new ol.layer.Tile({
                        source: new ol.source.OSM()
                    }),
                    new ol.layer.Vector({
                        source: vectorSource
                    })
                ],
                view: new ol.View({
                    center: ol.proj.fromLonLat([
                        safeNumber(scope.config.CenterLon, -73.5),
                        safeNumber(scope.config.CenterLat, 45.5)
                    ]),
                    zoom: safeNumber(scope.config.Zoom, 5),
                    minZoom: safeNumber(scope.config.MinZoom, 2),
                    maxZoom: safeNumber(scope.config.MaxZoom, 18)
                })
            });

            map.on('click', function (evt) {
                var clickedFeature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    return feature;
                });

                if (clickedFeature) {
                    if (scope.config.LockMap) {
                        return;
                    }
                    if (scope.config.SelectedMarkerIndex === ALL_MARKERS_SELECTED) {
                        return;
                    }

                    var clickedIndex = clickedFeature.get('markerIndex');

                    if (scope.config.SelectedMarkerIndex === clickedIndex) {
                        scope.config.SelectedMarkerIndex = -1;
                        clearEditor();
                    } else {
                        scope.config.SelectedMarkerIndex = clickedIndex;
                        loadSelectedMarkerIntoEditor();
                    }

                    rebuildMarkers();
                    renderVisiblePopups();

                    if (!scope.$$phase) {
                        scope.$applyAsync();
                    }
                    return;
                }

                if (scope.config.LockMap) {
                    return;
                }
                if (scope.config.SelectedMarkerIndex === ALL_MARKERS_SELECTED) {
                    return;
                }

                scope.config.SelectedMarkerIndex = -1;
                clearEditor();

                if (!scope.config.EnableMarkers) {
                    rebuildMarkers();
                    renderVisiblePopups();
                    if (!scope.$$phase) {
                        scope.$applyAsync();
                    }
                    return;
                }

                var coord = ol.proj.toLonLat(evt.coordinate);
                scope.config.Markers = ensureArray(scope.config.Markers);
                scope.config.Markers.push({
                    lon: coord[0],
                    lat: coord[1],
                    title: '',
                    displayUrl: '',
                    displayLabel: '',
                    openInNewTab: true,
                    hidePopupTitle: false,
                    labelOffsetX: 0,
                    labelOffsetY: 0,
                    labelPositionSaved: false
                });

                scope.config.SelectedMarkerIndex = -1;
                clearEditor();

                rebuildMarkers();
                renderVisiblePopups();

                if (!scope.$$phase) {
                    scope.$applyAsync();
                }
            });

            rebuildMarkers();
            renderVisiblePopups();
            applyMapLockState();

            setTimeout(function () {
                if (map) {
                    map.updateSize();
                    applyControlVisibility();
                    applyLockBadgeVisibility();
                    renderVisiblePopups();
                }
            }, 100);
        }

        function updateViewFromConfig() {
            if (!map || !window.ol) {
                return;
            }

            var view = map.getView();
            view.setCenter(
                ol.proj.fromLonLat([
                    safeNumber(scope.config.CenterLon, -73.5),
                    safeNumber(scope.config.CenterLat, 45.5)
                ])
            );
            view.setZoom(safeNumber(scope.config.Zoom, 5));
            view.setMinZoom(safeNumber(scope.config.MinZoom, 2));
            view.setMaxZoom(safeNumber(scope.config.MaxZoom, 18));
        }

        function onDataUpdate(data) {
            // No datasource-based popup content in this version.
        }

        function onConfigChange(config, oldConfig) {
            ensureConfig();

            if (!map) {
                initializeOpenLayers();
                return;
            }

            var oldMarkers = oldConfig && oldConfig.Markers ? JSON.stringify(oldConfig.Markers) : '';
            var newMarkers = scope.config.Markers ? JSON.stringify(scope.config.Markers) : '';

            var useCurrentViewTriggered =
                oldConfig &&
                scope.config.UseCurrentViewTrigger !== oldConfig.UseCurrentViewTrigger;

            var deleteSelectedTriggered =
                oldConfig &&
                scope.config.DeleteSelectedMarkerTrigger !== oldConfig.DeleteSelectedMarkerTrigger;

            var toggleSelectAllTriggered =
                oldConfig &&
                scope.config.ToggleSelectAllMarkersTrigger !== oldConfig.ToggleSelectAllMarkersTrigger;

            var saveSelectedMarkerTriggered =
                oldConfig &&
                scope.config.SaveSelectedMarkerTrigger !== oldConfig.SaveSelectedMarkerTrigger;

            var saveLabelPositionsTriggered =
                oldConfig &&
                scope.config.SaveLabelPositionsTrigger !== oldConfig.SaveLabelPositionsTrigger;

            var resetLabelPositionsTriggered =
                oldConfig &&
                scope.config.ResetLabelPositionsTrigger !== oldConfig.ResetLabelPositionsTrigger;

            if (useCurrentViewTriggered) {
                saveCurrentViewAsDefault();
            }

            if (deleteSelectedTriggered) {
                deleteSelectedMarker();
            }

            if (toggleSelectAllTriggered) {
                toggleSelectAllMarkers();
            }

            if (saveSelectedMarkerTriggered) {
                saveEditorIntoSelectedMarker();
            }

            if (saveLabelPositionsTriggered) {
                saveLabelPositionsToMarkers();
            }

            if (resetLabelPositionsTriggered) {
                resetAllLabelPositions();
            }

            var viewChanged =
                !oldConfig ||
                scope.config.CenterLon !== oldConfig.CenterLon ||
                scope.config.CenterLat !== oldConfig.CenterLat ||
                scope.config.Zoom !== oldConfig.Zoom ||
                scope.config.MinZoom !== oldConfig.MinZoom ||
                scope.config.MaxZoom !== oldConfig.MaxZoom;

            var markerStyleChanged =
                !oldConfig ||
                scope.config.MarkerIconUrl !== oldConfig.MarkerIconUrl ||
                scope.config.MarkerScale !== oldConfig.MarkerScale ||
                scope.config.SelectedMarkerScale !== oldConfig.SelectedMarkerScale;

            var markersChanged = oldMarkers !== newMarkers;

            var selectionChanged =
                !oldConfig ||
                scope.config.SelectedMarkerIndex !== oldConfig.SelectedMarkerIndex;

            var lockChanged =
                !oldConfig ||
                scope.config.LockMap !== oldConfig.LockMap;

            var controlChanged =
                !oldConfig ||
                scope.config.ShowZoomControl !== oldConfig.ShowZoomControl ||
                scope.config.ShowAttribution !== oldConfig.ShowAttribution;

            var markerEditorChanged =
                !oldConfig ||
                scope.config.MarkerEditTitle !== oldConfig.MarkerEditTitle ||
                scope.config.MarkerEditDisplayUrl !== oldConfig.MarkerEditDisplayUrl ||
                scope.config.MarkerEditDisplayLabel !== oldConfig.MarkerEditDisplayLabel ||
                scope.config.MarkerEditOpenInNewTab !== oldConfig.MarkerEditOpenInNewTab ||
                scope.config.MarkerEditHidePopupTitle !== oldConfig.MarkerEditHidePopupTitle;

            if (viewChanged) {
                updateViewFromConfig();
            }

            if (markerStyleChanged || markersChanged || selectionChanged || deleteSelectedTriggered || toggleSelectAllTriggered || saveSelectedMarkerTriggered || !oldConfig) {
                rebuildMarkers();
            }

            if (lockChanged) {
                applyMapLockState();
            }

            if (controlChanged && !lockChanged) {
                applyControlVisibility();
            }

            if (
                markersChanged ||
                selectionChanged ||
                deleteSelectedTriggered ||
                toggleSelectAllTriggered ||
                saveSelectedMarkerTriggered ||
                saveLabelPositionsTriggered ||
                resetLabelPositionsTriggered ||
                markerEditorChanged ||
                lockChanged ||
                !oldConfig
            ) {
                renderVisiblePopups();
            }

            setTimeout(function () {
                if (map) {
                    map.updateSize();
                    applyLockBadgeVisibility();
                    renderVisiblePopups();
                }
            }, 0);
        }

        function onResize(width, height) {
            if (map) {
                setTimeout(function () {
                    map.updateSize();
                    applyControlVisibility();
                    applyLockBadgeVisibility();
                    renderVisiblePopups();
                }, 0);
            }
        }

        function initializeOpenLayers() {
            ensureConfig();
            loadCssOnce(scope.config.OpenLayersCssUrl);
            loadScriptOnce(scope.config.OpenLayersJsUrl, function () {
                createMap();
                rebuildMarkers();
                applyControlVisibility();
                applyLockBadgeVisibility();
                renderVisiblePopups();
            });
        }

        initializeOpenLayers();
    };

    PV.symbolCatalog.register(definition);

})(window.PIVisualization);
