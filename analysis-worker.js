/**
 * DICOM ROI Analysis Worker
 * Offloads heavy statistical calculations to a background thread to prevent UI freezing.
 * 
 * Optimized for:
 * 1. Memory Efficiency: Avoids creating large Float32Array copies.
 * 2. Streaming: Sends results back as they are processed.
 * 3. Robustness: Improved error reporting and progress tracking.
 */

// === KEY FIX: Wrap importScripts in try/catch so GitHub Pages failures are caught explicitly ===
// === 關鍵修正：將 importScripts 包在 try/catch 中，以明確捕捉 GitHub Pages 上的失敗 ===
let _parserReady = false;
try {
    importScripts('./dicomParser.min.js');
    _parserReady = true;
} catch (importErr) {
    // Signal to main thread that the worker failed to initialize
    // 通知主執行緒 Worker 初始化失敗
    self.postMessage({
        type: 'error',
        message: 'Worker failed to load dicom-parser: ' + importErr.message,
        fileName: null
    });
    // Throw so the worker's onerror event also fires on the main thread
    // 拋出例外讓主執行緒的 worker.onerror 事件也能觸發
    throw importErr;
}

// Read values for CSV output. Rows and Columns use the DICOM US value
// representation and must be read as uint16 rather than as strings.
// CSV 匯出值：Rows / Columns 為 US 數值型標籤，需以 uint16 讀取。
function getDicomSliceLocationValue(dataSet) {
    const storedLocation = (dataSet.string('x00201041') || '').trim();
    if (storedLocation) return storedLocation;

    // Some CT scanners omit (0020,1041) but provide Image Position/Orientation.
    const position = (dataSet.string('x00200032') || '').split('\\').map(Number);
    const orientation = (dataSet.string('x00200037') || '').split('\\').map(Number);
    if (
        position.length >= 3 &&
        orientation.length >= 6 &&
        position.slice(0, 3).every(Number.isFinite) &&
        orientation.slice(0, 6).every(Number.isFinite)
    ) {
        const row = orientation.slice(0, 3);
        const column = orientation.slice(3, 6);
        const normal = [
            row[1] * column[2] - row[2] * column[1],
            row[2] * column[0] - row[0] * column[2],
            row[0] * column[1] - row[1] * column[0]
        ];
        const coordinate = position[0] * normal[0]
            + position[1] * normal[1]
            + position[2] * normal[2];
        if (Number.isFinite(coordinate)) return String(coordinate);
    }

    const zPosition = Number(position[2]);
    return Number.isFinite(zPosition) ? String(zPosition) : '';
}

function getDicomExportValue(dataSet, tag) {
    try {
        if (tag.startsWith('x0053104')
            && (dataSet.string('x00530010') || '').trim() !== 'GEHC_CT_ADVAPP_001') {
            return '';
        }
        if (tag === 'x00201041') {
            return getDicomSliceLocationValue(dataSet);
        }
        if (tag === 'x00280010' || tag === 'x00280011') {
            const value = dataSet.uint16(tag);
            return Number.isFinite(value) ? value : '';
        }
        const value = dataSet.string(tag);
        return value === undefined || value === null ? '' : String(value).trim();
    } catch (error) {
        return '';
    }
}

self.onmessage = function(e) {
    // Guard: if parser didn't load, report and stop
    // 防禦：若解析器未載入，回報並停止
    if (!_parserReady) {
        self.postMessage({ type: 'error', message: 'dicom-parser not loaded in worker.', fileName: null });
        self.postMessage({ type: 'complete' });
        return;
    }

    const { command, data } = e.data;

    if (command === 'analyze') {
        const { files, roiCenters, roiRadius, commonTags, filterValue } = data;
        const totalItems = files.length;
        let completed = 0;

        for (let i = 0; i < files.length; i++) {
            const fileData = files[i];
            const { name, buffer } = fileData;
            const fileResults = [];

            try {
                const byteArray = new Uint8Array(buffer);
                const dataSet = dicomParser.parseDicom(byteArray);

                // 1. Apply Slice Location Filter
                if (filterValue) {
                    const sliceLoc = dataSet.string('x00201041') || '';
                    if (!isMatch(sliceLoc, filterValue)) {
                        completed++;
                        sendProgress(completed, totalItems);
                        continue;
                    }
                }

                // 2. Check if pixel data exists
                if (!dataSet.elements.x7fe00010) {
                    throw new Error('No pixel data found in DICOM file.');
                }

                // 3. Extract Raw Pixel Info (No float cloning here)
                const { pixels, slope, intercept } = getPixelDataInfo(dataSet, byteArray);
                const rows = dataSet.uint16('x00280010');
                const cols = dataSet.uint16('x00280011');
                const N = pixels.length;

                // 4. Calculate Full Image Stats (Math-optimized for raw integers)
                // v' = v*S + I
                // Sum(v') = S * Sum(v) + N * I
                // Sum(v'^2) = S^2 * Sum(v^2) + 2*S*I*Sum(v) + N*I^2
                let sumRaw = 0, sumSqRaw = 0;
                for (let j = 0; j < N; j++) {
                    const v = pixels[j];
                    sumRaw += v;
                    sumSqRaw += v * v;
                }

                const fullMean = (sumRaw / N) * slope + intercept;
                // Variance(X') = Scale^2 * Variance(X)
                const rawMean = sumRaw / N;
                const rawVar = Math.max(0, (sumSqRaw / N) - (rawMean * rawMean));
                const fullSD = Math.sqrt(rawVar) * Math.abs(slope);

                // 5. Extract Common Tags
                const dicomTags = {};
        for (const { tag, name: tagName } of commonTags) {
            dicomTags[tagName] = getDicomExportValue(dataSet, tag);
        }

                // 6. Multi-ROI Analysis (On-the-fly rescaling)
                for (let roiIdx = 0; roiIdx < roiCenters.length; roiIdx++) {
                    const center = roiCenters[roiIdx];
                    const roiStats = calculateROIStatsOptimized(pixels, cols, rows, center, roiRadius, slope, intercept);

                    fileResults.push({
                        FileName: name,
                        ROI_ID: roiIdx + 1,
                        ROI_Mean: roiStats.mean.toFixed(4),
                        ROI_Noise_SD: roiStats.sd.toFixed(4),
                        FullImage_Mean: fullMean.toFixed(4),
                        FullImage_SD: fullSD.toFixed(4),
                        ROI_X: center.x,
                        ROI_Y: center.y,
                        ROI_R: roiRadius,
                        ...roiPhysicalFields(dataSet, roiRadius, roiStats.count),
                ...dicomTags,
                ...(data.resultMetadata || {})
                    });
                }

                // 7. Stream result for this file
                self.postMessage({ type: 'result_chunk', results: fileResults });

            } catch (err) {
                // Report error back to UI
                self.postMessage({ 
                    type: 'error', 
                    message: err.message, 
                    fileName: name 
                });
            }

            completed++;
            sendProgress(completed, totalItems);
        }

        // Final completion message
        self.postMessage({ type: 'complete' });

    } else if (command === 'analyze_chunk' || command === 'analyze_single' || command === 'analyze_cross_series') {
        const { file, roiCenters, roiRadius, commonTags, filterValue } = data;
        const chunkIndex = command === 'analyze_chunk' ? data.chunkIndex : 0;
        const completeType = command === 'analyze_chunk'
            ? 'chunk_complete'
            : command === 'analyze_cross_series' ? 'cross_series_complete' : 'single_complete';
        const fileResults = [];

        try {
            const byteArray = new Uint8Array(file.buffer);
            const dataSet = dicomParser.parseDicom(byteArray);

            // 1. Apply Slice Location Filter
            if (filterValue) {
                const sliceLoc = dataSet.string('x00201041') || '';
                if (!isMatch(sliceLoc, filterValue)) {
                    self.postMessage({ type: completeType, results: [], chunkIndex, skipped: true });
                    return;
                }
            }

            // 2. Check if pixel data exists
            if (!dataSet.elements.x7fe00010) {
                throw new Error('No pixel data found in DICOM file.');
            }

            // 3. Extract Raw Pixel Info
            const { pixels, slope, intercept } = getPixelDataInfo(dataSet, byteArray);
            const rows = dataSet.uint16('x00280010');
            const cols = dataSet.uint16('x00280011');
            const N = pixels.length;

            // 4. Calculate Full Image Stats
            let sumRaw = 0, sumSqRaw = 0;
            for (let j = 0; j < N; j++) {
                const v = pixels[j];
                sumRaw += v;
                sumSqRaw += v * v;
            }

            const fullMean = (sumRaw / N) * slope + intercept;
            const rawMean = sumRaw / N;
            const rawVar = Math.max(0, (sumSqRaw / N) - (rawMean * rawMean));
            const fullSD = Math.sqrt(rawVar) * Math.abs(slope);

            // 5. Extract Common Tags
            const dicomTags = {};
        for (const { tag, name: tagName } of commonTags) {
            dicomTags[tagName] = getDicomExportValue(dataSet, tag);
        }

            // 6. Multi-ROI Analysis
            for (let roiIdx = 0; roiIdx < roiCenters.length; roiIdx++) {
                const center = roiCenters[roiIdx];
                const roiStats = calculateROIStatsOptimized(pixels, cols, rows, center, roiRadius, slope, intercept);

                fileResults.push({
                    FileName: file.name,
                    ROI_ID: roiIdx + 1,
                    ROI_Mean: roiStats.mean.toFixed(4),
                    ROI_Noise_SD: roiStats.sd.toFixed(4),
                    FullImage_Mean: fullMean.toFixed(4),
                    FullImage_SD: fullSD.toFixed(4),
                    ROI_X: center.x,
                    ROI_Y: center.y,
            ROI_R: roiRadius,
            ...roiPhysicalFields(dataSet, roiRadius, roiStats.count),
            ...dicomTags,
            ...(data.resultMetadata || {})
                });
            }

        self.postMessage({
            type: completeType,
            results: fileResults,
            chunkIndex,
            taskIndex: data.taskIndex,
            seriesKey: data.seriesKey,
            skipped: false
        });

        } catch (err) {
            self.postMessage({ type: 'error', message: err.message, fileName: file.name });
        self.postMessage({
            type: completeType,
            results: [],
            chunkIndex,
            taskIndex: data.taskIndex,
            seriesKey: data.seriesKey,
            skipped: true
        });
        }
    }
};

/**
 * Filter matching logic
 */
function isMatch(sliceLoc, filterValue) {
    if (sliceLoc === filterValue) return true;
    const filterNum = parseFloat(filterValue);
    if (!isNaN(filterNum)) {
        const sliceNum = parseFloat(sliceLoc);
        return (!isNaN(sliceNum) && Math.abs(sliceNum - filterNum) < 0.001);
    }
    return sliceLoc.includes(filterValue);
}

/**
 * DICOM Pixel Info Extraction (Memory Efficient)
 * Returns TypedArray view and rescaling parameters without cloning the full array.
 */
function getPixelDataInfo(dataSet, byteArray) {
    const pixelDataElement = dataSet.elements.x7fe00010;
    const rows = dataSet.uint16('x00280010');
    const cols = dataSet.uint16('x00280011');
    const bitsAllocated = dataSet.uint16('x00280100');
    const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0=Unsigned, 1=Signed
    const slope = parseFloat(dataSet.string('x00281053')) || 1;
    const intercept = parseFloat(dataSet.string('x00281052')) || 0;

    let pixels;
    const numPixels = rows * cols;
    
    // Check if data is within bounds
    if (pixelDataElement.dataOffset + numPixels * (bitsAllocated / 8) > byteArray.length) {
        throw new Error('Pixel data buffer overflow (corrupted DICOM).');
    }

    if (bitsAllocated === 16) {
        if (pixelRepresentation === 1) {
            pixels = new Int16Array(byteArray.buffer, pixelDataElement.dataOffset, numPixels);
        } else {
            pixels = new Uint16Array(byteArray.buffer, pixelDataElement.dataOffset, numPixels);
        }
    } else {
        pixels = new Uint8Array(byteArray.buffer, pixelDataElement.dataOffset, numPixels);
    }

    return { pixels, slope, intercept };
}

/**
 * ROI Statistics Calculation with on-the-fly rescaling
 */
function calculateROIStatsOptimized(pixels, cols, rows, center, radius, slope, intercept) {
    let sum = 0, sumSq = 0, count = 0;
    const rSq = radius * radius;

    const startY = Math.max(0, Math.floor(center.y - radius));
    const endY = Math.min(rows - 1, Math.ceil(center.y + radius));
    const startX = Math.max(0, Math.floor(center.x - radius));
    const endX = Math.min(cols - 1, Math.ceil(center.x + radius));

    for (let y = startY; y <= endY; y++) {
        const rowOffset = y * cols;
        for (let x = startX; x <= endX; x++) {
            const dx = x - center.x;
            const dy = y - center.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq <= rSq) {
                // Apply rescaling on the fly to avoid large float copies
                const rawVal = pixels[rowOffset + x];
                const v = rawVal * slope + intercept;
                sum += v;
                sumSq += v * v;
                count++;
            }
        }
    }

    if (count === 0) return { mean: 0, sd: 0, count: 0 };

    const mean = sum / count;
    const sd = Math.sqrt(Math.max(0, (sumSq / count) - (mean * mean)));
    return { mean, sd, count };
}

/**
 * Physical ROI fields from DICOM Pixel Spacing (x00280030).
 * Area uses actual sampled pixel count (edge-clipped circles are smaller than PI*r^2).
 */
function getPixelSpacingMm(dataSet) {
    try {
        const raw = dataSet.string('x00280030');
        if (!raw) return null;
        const p = String(raw).split('\\').map(parseFloat);
        if (p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]) && p[0] > 0 && p[1] > 0) {
            return { row: p[0], col: p[1] };
        }
    } catch (e) {}
    return null;
}

function roiPhysicalFields(dataSet, radiusPx, pixelCount) {
    const sp = getPixelSpacingMm(dataSet);
    if (!sp) {
        return { ROI_Pixels: pixelCount, ROI_R_mm: 'N/A', ROI_Area_mm2: 'N/A' };
    }
    return {
        ROI_Pixels: pixelCount,
        ROI_R_mm: (radiusPx * (sp.row + sp.col) / 2).toFixed(4),
        ROI_Area_mm2: (pixelCount * sp.row * sp.col).toFixed(4)
    };
}

function sendProgress(completed, total) {
    self.postMessage({ type: 'progress', completed, total });
}
