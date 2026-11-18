import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:health_rag/url_resolver.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('BackendUrlResolver', () {
    test('returns the gist URL when the gist answers', () async {
      final client = MockClient((req) async {
        if (req.url.host.contains('gist.githubusercontent.com')) {
          return http.Response(
              jsonEncode({'url': 'https://gist-url.app.lhr.life'}), 200);
        }
        return http.Response('not found', 404);
      });
      final url = await BackendUrlResolver.resolve(
        fallback: 'https://fallback.invalid',
        httpClient: client,
      );
      expect(url, 'https://gist-url.app.lhr.life');
    });

    test('falls back to the site json when the gist fails', () async {
      final client = MockClient((req) async {
        if (req.url.host.contains('gist.githubusercontent.com')) {
          return http.Response('error', 500);
        }
        if (req.url.host == 'health-rag-chatbot.pages.dev') {
          return http.Response(
              jsonEncode({'url': 'https://site-url.app.lhr.life'}), 200);
        }
        return http.Response('not found', 404);
      });
      final url = await BackendUrlResolver.resolve(
        fallback: 'https://fallback.invalid',
        httpClient: client,
      );
      expect(url, 'https://site-url.app.lhr.life');
    });

    test('falls back to the baked-in default when both lookups fail',
        () async {
      final client = MockClient((_) async => http.Response('error', 500));
      final url = await BackendUrlResolver.resolve(
        fallback: 'https://fallback.invalid',
        httpClient: client,
      );
      expect(url, 'https://fallback.invalid');
    });

    test('retries the gist once before moving on', () async {
      var gistCalls = 0;
      final client = MockClient((req) async {
        if (req.url.host.contains('gist.githubusercontent.com')) {
          gistCalls++;
          if (gistCalls == 1) throw http.ClientException('timeout');
          return http.Response(
              jsonEncode({'url': 'https://gist-url.app.lhr.life'}), 200);
        }
        return http.Response('not found', 404);
      });
      final url = await BackendUrlResolver.resolve(
        fallback: 'https://fallback.invalid',
        httpClient: client,
      );
      expect(url, 'https://gist-url.app.lhr.life');
      expect(gistCalls, 2);
    });
  });
}
