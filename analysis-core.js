/* Shared, DOM-free analysis rules. The viewer, Worker and tests use the same code. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.AnalysisCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function () {
    'use strict';

    const EXACT_TOLERANCE_MM = 0.001;
    const TIE_TOLERANCE_MM = 0.000001;
    const SELECTION_FIELDS = ['SliceSelectionMode', 'RequestedSliceLocation', 'SliceLocation',
        'SliceOffset_mm', 'MaxSliceDistance_mm'];
    const ACQUISITION_FIELDS = ['AcquisitionNumber', 'AcquisitionTime', 'InstanceNumber'];
    const FORBIDDEN_FIELDS = new Set(['SeriesInstanceUID', 'FrameOfReferenceUID', 'SOPInstanceUID', 'ProtocolName']);

    function string(ds, tag) {
        try { return String(ds.string(tag) ?? '').trim(); } catch (_) { return ''; }
    }
    function number(ds, tag) {
        const value = string(ds, tag);
        return value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    }
    function ushort(ds, tag) {
        try { return ds.uint16(tag); } catch (_) { return undefined; }
    }
    function vector(ds, tag, length) {
        const raw = string(ds, tag);
        if (!raw) return null;
        if (raw.split('\\').some(value => value.trim() === '')) return null;
        const values = raw.split('\\').map(Number);
        return values.length === length && values.every(Number.isFinite) ? values : null;
    }
    const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    const subtract = (a, b) => a.map((value, i) => value - b[i]);
    function normalize(v) {
        const length = Math.hypot(...v);
        return length > 0 ? v.map(value => value / length) : null;
    }
    function normal(orientation) {
        return normalize([
            orientation[1] * orientation[5] - orientation[2] * orientation[4],
            orientation[2] * orientation[3] - orientation[0] * orientation[5],
            orientation[0] * orientation[4] - orientation[1] * orientation[3]
        ]);
    }
    function sliceLocation(ds) {
        const location = number(ds, 'x00201041');
        if (location !== null) return location;
        const position = vector(ds, 'x00200032', 3);
        if (!position) return null;
        const orientation = vector(ds, 'x00200037', 6);
        const n = orientation && normal(orientation);
        return n ? dot(position, n) : position[2];
    }
    function tagValue(ds, tag) {
        if (tag.startsWith('x005310') && string(ds, 'x00530010') !== 'GEHC_CT_ADVAPP_001') return '';
        if (tag === 'x00201041') return number(ds, tag) !== null ? string(ds, tag) : (sliceLocation(ds) ?? '');
        if (tag === 'x00280010' || tag === 'x00280011') return ushort(ds, tag) ?? '';
        return string(ds, tag);
    }
    function settings(input) {
        const mode = input.mode || 'all';
        if (!['all', 'exact', 'nearest'].includes(mode)) throw new Error('請選擇切片規則');
        if (mode === 'all') return { mode, target: null, maxDistance: null };
        if (String(input.target ?? '').trim() === '' || !Number.isFinite(Number(input.target))) {
            throw new Error('請輸入數值形式的 Slice Location（mm）');
        }
        const target = Number(input.target);
        if (mode === 'exact') return { mode, target, maxDistance: null };
        if (String(input.maxDistance ?? '').trim() === '' || !Number.isFinite(Number(input.maxDistance)) || Number(input.maxDistance) < 0) {
            throw new Error('最近切片模式需手動輸入最大距離（mm，必須 ≥ 0）');
        }
        return { mode, target, maxDistance: Number(input.maxDistance) };
    }

    // All acquisitions at the selected position are retained. No averaging or implicit tie-break.
    function selectFiles(files, config, choice = null, single = false) {
        const locations = files.map(file => ({ file, location: sliceLocation(file.dataSet) }));
        const result = { files: [], candidates: [], reason: '', filtered: 0 };
        if (config.mode === 'all') result.files = files.slice();
        else if (config.mode === 'exact') {
            result.files = locations.filter(item => item.location !== null &&
                Math.abs(item.location - config.target) < EXACT_TOLERANCE_MM).map(item => item.file);
            if (!result.files.length) result.reason = `沒有符合 ${config.target} mm 的切片（差距需 < 0.001 mm）`;
        } else if (single) {
            result.files = locations.filter(item => item.location !== null &&
                Math.abs(item.location - config.target) <= config.maxDistance).map(item => item.file);
            if (!result.files.length) result.reason = '所選影像缺少位置或超出最大距離；不會替換成另一張';
        } else {
            const valid = locations.filter(item => item.location !== null);
            const minimum = valid.reduce((best, item) => Math.min(best, Math.abs(item.location - config.target)), Infinity);
            if (!valid.length) result.reason = '影像缺少可用的 Slice Location／Image Position';
            else if (minimum > config.maxDistance) {
                result.reason = `最近切片距離 ${Number(minimum.toFixed(6))} mm，超過上限 ${config.maxDistance} mm`;
            } else {
                const nearest = valid.filter(item => Math.abs(item.location - config.target) <= config.maxDistance &&
                    Math.abs(Math.abs(item.location - config.target) - minimum) <= TIE_TOLERANCE_MM);
                const positions = [];
                nearest.forEach(item => {
                    if (!positions.some(value => Math.abs(value - item.location) <= TIE_TOLERANCE_MM)) positions.push(item.location);
                });
                positions.sort((a, b) => a - b);
                const chosen = choice === null || choice === '' || choice === undefined ? null : Number(choice);
                if (positions.length > 1 && !positions.some(value => chosen !== null && Math.abs(value - chosen) <= TIE_TOLERANCE_MM)) {
                    result.candidates = positions;
                    result.reason = '兩側切片等距，請指定位置';
                } else {
                    const location = positions.length === 1 ? positions[0] : chosen;
                    result.files = nearest.filter(item => Math.abs(item.location - location) <= TIE_TOLERANCE_MM).map(item => item.file);
                }
            }
        }
        result.filtered = result.candidates.length ? 0 : files.length - result.files.length;
        return result;
    }
    function selectionMetadata(ds, config) {
        const location = sliceLocation(ds);
        return {
            SliceSelectionMode: config.mode,
            RequestedSliceLocation: config.target ?? '',
            SliceLocation: tagValue(ds, 'x00201041'),
            SliceOffset_mm: config.target === null || location === null ? '' : Number((location - config.target).toFixed(6)),
            MaxSliceDistance_mm: config.maxDistance ?? ''
        };
    }
    function circleFits(center, radius, columns, rows) {
        return [center.x, center.y, radius, columns, rows].every(Number.isFinite) && radius > 0 &&
            center.x - radius >= 0 && center.y - radius >= 0 &&
            center.x + radius <= columns - 1 && center.y + radius <= rows - 1;
    }
    function geometry(ds) {
        const position = vector(ds, 'x00200032', 3);
        const orientation = vector(ds, 'x00200037', 6);
        const spacing = vector(ds, 'x00280030', 2);
        if (!position || !orientation || !spacing || spacing.some(value => value <= 0)) return null;
        const x = normalize(orientation.slice(0, 3)), y = normalize(orientation.slice(3, 6));
        const n = normal(orientation);
        if (!x || !y || !n || Math.abs(dot(x, y)) > 0.001) return null;
        return { position, x, y, normal: n, rowSpacing: spacing[0], colSpacing: spacing[1],
            frame: string(ds, 'x00200052'), study: string(ds, 'x0020000d') };
    }
    function anchor(center, ds) {
        const geo = geometry(ds);
        if (!geo) return null;
        return { point: geo.position.map((value, i) => value + geo.x[i] * center.x * geo.colSpacing + geo.y[i] * center.y * geo.rowSpacing),
            normal: geo.normal, frameOfReferenceUID: geo.frame, studyUID: geo.study };
    }
    function mapRois(source, ds, crossSeries) {
        let centers = source.centers.map(center => ({ ...center })), radius = source.radius;
        let transferMode = crossSeries ? 'fixed-pixel-coordinate' : 'source-pixel-coordinate';
        const target = geometry(ds);
        if (crossSeries && source.mode === 'patient') {
            if (!target || !source.geometry || source.anchors.some(value => !value)) {
                return { error: '缺少完整病人座標、方向或 Pixel Spacing，無法對位' };
            }
            for (const point of source.anchors) {
                if (point.frameOfReferenceUID && target.frame) {
                    if (point.frameOfReferenceUID !== target.frame) return { error: 'Frame of Reference 不同，無法對位' };
                } else if (!point.studyUID || !target.study || point.studyUID !== target.study) {
                    return { error: 'Frame UID 缺漏，且無法確認同一 Study' };
                }
                if (Math.abs(dot(point.normal, target.normal)) < 0.995) return { error: '切面方向不同，無法投影 ROI' };
            }
            centers = source.anchors.map(point => {
                const delta = subtract(point.point, target.position);
                return { x: Math.round(dot(delta, target.x) / target.colSpacing), y: Math.round(dot(delta, target.y) / target.rowSpacing) };
            });
            const physicalArea = source.targetArea || Math.PI * source.radius ** 2 * source.geometry.rowSpacing * source.geometry.colSpacing;
            radius = Math.max(1, Math.round(Math.sqrt(physicalArea / (Math.PI * target.rowSpacing * target.colSpacing))));
            transferMode = 'patient-coordinate';
        } else if (!crossSeries && source.targetArea) {
            const spacing = vector(ds, 'x00280030', 2);
            if (!spacing || spacing.some(value => value <= 0)) return { error: '目標面積需要有效的 Pixel Spacing' };
            radius = Math.min(200, Math.max(5, Math.round(Math.sqrt(source.targetArea / (Math.PI * spacing[0] * spacing[1])))));
        }
        const rows = ushort(ds, 'x00280010'), columns = ushort(ds, 'x00280011');
        if (!(rows > 0 && columns > 0)) return { error: '缺少有效的 Rows／Columns' };
        const invalid = centers.flatMap((center, i) => circleFits(center, radius, columns, rows) ? [] : [i + 1]);
        return { centers, radius, transferMode, invalid,
            error: invalid.length ? `ROI ${invalid.join('、')} 圓周超出 ${columns} × ${rows} 影像邊界` : '' };
    }

    // Decode only supported, native single-frame monochrome pixels. Compressed data must fail explicitly.
    function pixels(ds) {
        const syntax = string(ds, 'x00020010');
        if (syntax && !['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2'].includes(syntax)) {
            throw new Error('不支援此 Transfer Syntax，請使用未壓縮 DICOM');
        }
        if ((number(ds, 'x00280008') || 1) > 1 || (ushort(ds, 'x00280002') || 1) !== 1) {
            throw new Error('目前分析只支援單張、單色 DICOM');
        }
        const pixel = ds.elements.x7fe00010;
        const rows = ushort(ds, 'x00280010'), columns = ushort(ds, 'x00280011');
        const bits = ushort(ds, 'x00280100'), stored = ushort(ds, 'x00280101') || bits;
        const high = ushort(ds, 'x00280102') ?? stored - 1;
        const signed = ushort(ds, 'x00280103') === 1;
        const count = rows * columns, bytes = count * bits / 8;
        if (!pixel || pixel.encapsulatedPixelData || ![8, 16].includes(bits) || !(count > 0) ||
            stored < 1 || stored > bits || high < stored - 1 || high >= bits ||
            pixel.length < bytes || pixel.dataOffset + bytes > ds.byteArray.byteLength) {
            throw new Error('Pixel Data 缺漏、長度不足或像素格式不支援');
        }
        const view = new DataView(ds.byteArray.buffer, ds.byteArray.byteOffset + pixel.dataOffset, bytes);
        const little = syntax !== '1.2.840.10008.1.2.2';
        const slope = number(ds, 'x00281053') ?? 1, intercept = number(ds, 'x00281052') ?? 0;
        const output = new Float64Array(count), mask = 2 ** stored - 1, sign = 2 ** (stored - 1);
        for (let i = 0; i < count; i++) {
            let value = bits === 16 ? view.getUint16(i * 2, little) : view.getUint8(i);
            value = (value >>> (high - stored + 1)) & mask;
            if (signed && value >= sign) value -= 2 ** stored;
            output[i] = value * slope + intercept;
        }
        return { values: output, rows, columns };
    }
    function statistics(values) {
        let mean = 0, m2 = 0, count = 0;
        for (const value of values) {
            count++;
            const delta = value - mean;
            mean += delta / count;
            m2 += delta * (value - mean);
        }
        if (!count) throw new Error('ROI 沒有取樣像素');
        return { mean, sd: Math.sqrt(Math.max(0, m2 / count)), count };
    }
    function roiStatistics(image, center, radius) {
        if (!circleFits(center, radius, image.columns, image.rows)) throw new Error('ROI 圓周超出影像邊界');
        const values = [];
        for (let y = Math.ceil(center.y - radius); y <= Math.floor(center.y + radius); y++) {
            for (let x = Math.ceil(center.x - radius); x <= Math.floor(center.x + radius); x++) {
                if ((x - center.x) ** 2 + (y - center.y) ** 2 <= radius ** 2) values.push(image.values[y * image.columns + x]);
            }
        }
        return statistics(values);
    }
    function analyze(ds, task, tags) {
        const image = pixels(ds), full = statistics(image.values);
        const spacing = vector(ds, 'x00280030', 2);
        const metadata = {};
        tags.forEach(tag => { if (!FORBIDDEN_FIELDS.has(tag.name)) metadata[tag.name] = tagValue(ds, tag.tag); });
        return task.centers.map((center, i) => {
            const roi = roiStatistics(image, center, task.radius);
            const physical = spacing && spacing.every(value => value > 0);
            return { ...metadata, ...task.metadata, FileName: task.fileName,
                ROI_ID: i + 1, ROI_X: center.x, ROI_Y: center.y, ROI_R: task.radius,
                ROI_Mean: roi.mean.toFixed(4), ROI_Noise_SD: roi.sd.toFixed(4), ROI_Pixels: roi.count,
                ROI_R_mm: physical ? (task.radius * (spacing[0] + spacing[1]) / 2).toFixed(4) : '',
                ROI_Area_mm2: physical ? (roi.count * spacing[0] * spacing[1]).toFixed(4) : '',
                FullImage_Mean: full.mean.toFixed(4), FullImage_SD: full.sd.toFixed(4) };
        });
    }
    function csvCell(value) {
        const text = String(value ?? '');
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }
    return { EXACT_TOLERANCE_MM, TIE_TOLERANCE_MM, SELECTION_FIELDS, ACQUISITION_FIELDS,
        string, number, vector, sliceLocation, tagValue, settings, selectFiles, selectionMetadata,
        circleFits, geometry, anchor, mapRois, pixels, statistics, roiStatistics, analyze, csvCell };
});
