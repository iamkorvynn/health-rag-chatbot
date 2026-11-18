import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:health_rag/url_resolver.dart';
import 'package:http/http.dart' as http;

/// Live integration test — hits the real gist and the real site.
/// Run on demand (`flutter test test/url_resolver_live_test.dart`); not
/// part of the offline suite because it needs network access.
void main() {
  test('resolver picks up the live published URL', () async {
    final resolved = await BackendUrlResolver.resolve(
      fallback: 'https://fallback.invalid',
    );
    expect(resolved, startsWith('https://'));
    expect(resolved, endsWith('.app.lhr.life'));

    // The resolver must agree with the gist it reads from.
    final gistRes = await http
        .get(Uri.parse(
            '${BackendUrlResolver.gistRawUrl}?t=${DateTime.now().millisecondsSinceEpoch}'))
        .timeout(const Duration(seconds: 15));
    final gistUrl =
        (jsonDecode(gistRes.body) as Map<String, dynamic>)['url'] as String;
    expect(resolved, gistUrl);

    // And the site's /api-url.json is a valid URL too (it can lag a few
    // minutes behind the gist — the site rebuilds on the 5-min keep-alive —
    // so it only has to parse, not match exactly).
    final siteRes = await http
        .get(Uri.parse(BackendUrlResolver.siteApiUrl))
        .timeout(const Duration(seconds: 15));
    final siteUrl =
        (jsonDecode(siteRes.body) as Map<String, dynamic>)['url'] as String;
    expect(siteUrl, startsWith('https://'));
    expect(siteUrl, endsWith('.app.lhr.life'));
  });
}
