/* Relative URLs work under both a site root and a GitHub Pages project path. */
importScripts('dicomParser.min.js', 'analysis-core.js');

self.onmessage = function (event) {
    const message = event.data;
    if (message.type !== 'analyze_task') return;
    const reply = { type: 'task_complete', runId: message.runId, taskIndex: message.taskIndex, results: [] };
    try {
        const dataSet = dicomParser.parseDicom(message.bytes);
        reply.results = AnalysisCore.analyze(dataSet, message.task, message.tags);
    } catch (error) {
        reply.error = error.message || String(error);
    }
    self.postMessage(reply);
};
