/**
 * Dedicated service worker for drip-fs fetch interception.
 *
 * Registered by bridge.js. Handles:
 * - Message events: receives download metadata via MessagePort
 * - Fetch events: intercepts download URLs and responds with the stream
 */

var downloadMap = new Map();

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function (event) {
  if (!event.ports || event.ports.length === 0) return;
  if (event.data === 'ping') return;

  var data = event.data;
  var port = event.ports[0];

  var downloadUrl =
    data.url ||
    self.registration.scope +
      Math.random().toString().slice(2) +
      '/' +
      (typeof data === 'string' ? data : data.filename);

  var metadata = { stream: null, data: data, port: port };

  if (data.readableStream) {
    metadata.stream = data.readableStream;
  } else if (data.transferringReadable) {
    port.onmessage = function (evt) {
      port.onmessage = null;
      metadata.stream = evt.data.readableStream;
    };
  } else {
    metadata.stream = new ReadableStream({
      start: function (controller) {
        port.onmessage = function (evt) {
          if (evt.data === 'end') return controller.close();
          if (evt.data === 'abort') {
            controller.error('Download aborted');
            return;
          }
          controller.enqueue(evt.data);
        };
      },
      cancel: function () {
        port.postMessage({ abort: true });
      },
    });
  }

  downloadMap.set(downloadUrl, metadata);
  port.postMessage({ download: downloadUrl });
});

self.addEventListener('fetch', function (event) {
  var url = event.request.url;

  if (url.endsWith('/ping')) {
    event.respondWith(new Response('pong'));
    return;
  }

  var metadata = downloadMap.get(url);
  if (!metadata) return;

  downloadMap.delete(url);

  var stream = metadata.stream;
  var data = metadata.data;
  var port = metadata.port;

  var headers = new Headers({
    'Content-Type': 'application/octet-stream; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Security-Policy': "default-src 'none'",
    'X-WebKit-CSP': "default-src 'none'",
    'X-XSS-Protection': '1; mode=block',
  });

  var dataHeaders = new Headers((data && data.headers) || {});
  if (dataHeaders.has('Content-Length')) {
    headers.set('Content-Length', dataHeaders.get('Content-Length'));
  }
  if (dataHeaders.has('Content-Disposition')) {
    headers.set('Content-Disposition', dataHeaders.get('Content-Disposition'));
  }

  event.respondWith(new Response(stream, { headers: headers }));
  port.postMessage({ debug: 'Download started' });
});
