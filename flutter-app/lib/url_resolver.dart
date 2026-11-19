import 'dart:convert';

import 'package:http/http.dart' as http;

/// Resolves the current backend base URL without any user input.
///
/// The free tunnel URL rotates on reconnect, so the address the app was
/// built with goes stale within minutes. The resolver asks, in order:
///   (a) the public gist the VPS keep-alive updates on every rotation
///       (fetched with a cache-buster `?t=<epoch ms>`, 8s timeout, one retry);
///   (b) the website's /api-url.json (the same JSON, written at site build
///       time by repo/web/scripts/write-api-url.js);
///   (c) the baked-in default (only if both lookups fail).
/// The resolved URL is cached in SharedPreferences by the caller.
class BackendUrlResolver {
  static const String gistRawUrl =
      'https://gist.githubusercontent.com/iamkorvynn/2c01b4fcaa4f8649a477d9c46f483560/raw/health-rag-backend-url.json';
  static const String siteApiUrl =
      'https://health-rag-chatbot.pages.dev/api-url.json';

  static const Duration _timeout = Duration(seconds: 8);

  static Future<String> resolve({
    required String fallback,
    http.Client? httpClient,
  }) async {
    final client = httpClient ?? http.Client();
    // (a) Gist, with one retry.
    for (var attempt = 0; attempt < 2; attempt++) {
      final url = await _fetchUrl(
        client,
        '$gistRawUrl?t=${DateTime.now().millisecondsSinceEpoch}',
      );
      if (url != null) return url;
    }
    // (b) Site json.
    final siteUrl = await _fetchUrl(client, siteApiUrl);
    if (siteUrl != null) return siteUrl;
    // (c) Baked-in default.
    return fallback;
  }

  static Future<String?> _fetchUrl(http.Client client, String url) async {
    try {
      final res = await client.get(Uri.parse(url)).timeout(_timeout);
      if (res.statusCode != 200) return null;
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) {
        final value = decoded['url'];
        if (value is String && value.startsWith('https://')) {
          return value.replaceAll(RegExp(r'/$'), '');
        }
      }
    } catch (_) {
      // Any failure here just moves on to the next source.
    }
    return null;
  }
}
