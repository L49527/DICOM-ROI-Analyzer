/**
 * DICOM ROI Analysis Worker
 * Offloads heavy statistical calculations to a background thread to prevent UI freezing.
 * 
 * Optimized for:
 * 1. Memory Efficiency: Avoids creating large Float32Array copies.
 * 2. Streaming: Sends results back as they are processed.
 * 3. Robustness: Improved error reporting and progress tracking.
 */

// Import dicom-parser from local path
importScripts('./dicomParser.min.js');

self.onmessage = function(e) {
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
                    const val = dataSet.string(tag);
                    if (val !== undefined) dicomTags[tagName] = val;
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
                        ...dicomTags
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

    if (count === 0) return { mean: 0, sd: 0 };

    const mean = sum / count;
    const sd = Math.sqrt(Math.max(0, (sumSq / count) - (mean * mean)));
    return { mean, sd };
}

function sendProgress(completed, total) {
    self.postMessage({ type: 'progress', completed, total });
}
