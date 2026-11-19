import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// Error thrown for API failures, with a human-readable message.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

/// Thin client for the Health RAG FastAPI backend.
///
/// Auth: POST /auth/login returns a JWT; every protected call sends
/// `Authorization: Bearer <token>`. The token and base URL are kept in
/// memory here and persisted by the caller (SharedPreferences).
class ApiClient {
  String baseUrl;
  String? token;
  String? username;
  String? role;
  final http.Client _http;

  ApiClient({required this.baseUrl, http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Map<String, String> get _authHeaders => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Uri _uri(String path) =>
      Uri.parse(baseUrl.replaceAll(RegExp(r'/$'), '') + path);

  /// Decode a JSON response or throw a readable ApiException.
  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body = {};
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) body = decoded;
    } catch (_) {}
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    final detail = body['detail'];
    throw ApiException(
      detail is String && detail.isNotEmpty
          ? detail
          : 'Request failed (${res.statusCode}). Check the API URL in Settings.',
      res.statusCode,
    );
  }

  Future<Map<String, dynamic>> _get(String path) async {
    try {
      final res = await _http.get(_uri(path), headers: _headers).timeout(
            const Duration(seconds: 30),
          );
      return _decode(res);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Could not reach the server. $e');
    }
  }

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> body) async {
    try {
      final res = await _http
          .post(_uri(path), headers: _headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 120));
      return _decode(res);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Could not reach the server. $e');
    }
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    try {
      final res = await _http.delete(_uri(path), headers: _headers).timeout(
            const Duration(seconds: 30),
          );
      return _decode(res);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Could not reach the server. $e');
    }
  }

  // ---------- public (no token needed) ----------

  Future<Map<String, dynamic>> health() => _get('/health');

  Future<Map<String, dynamic>> visitInfo() => _get('/visit-info');

  Future<TokenQueue> tokens() async =>
      TokenQueue.fromJson(await _get('/tokens'));

  Future<List<TestQuestion>> testQuestions() async {
    final body = await _get('/test-questions');
    final list = (body['questions'] as List? ?? []);
    return list
        .map((q) => TestQuestion.fromJson(q as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> takeToken(String name) =>
      _post('/tokens/take', {'name': name});

  // ---------- auth ----------

  Future<void> login(String username, String password) async {
    final body = await _post(
        '/auth/login', {'username': username, 'password': password});
    token = body['access_token'] as String?;
    this.username = body['username'] as String?;
    role = body['role'] as String?;
    if (token == null) throw ApiException('Login failed: no token returned.');
  }

  Future<void> validateSession() async {
    final body = await _get('/auth/me');
    username = body['username'] as String?;
    role = body['role'] as String?;
  }

  void logout() {
    token = null;
    username = null;
    role = null;
  }

  bool get isAdmin => role == 'admin';
  bool get canCallNext => role == 'staff' || role == 'admin';

  // ---------- protected ----------

  Future<List<Patient>> patients() async {
    final body = await _get('/patients');
    final list = (body['patients'] as List? ?? []);
    return list
        .map((p) => Patient.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// Ask a question. Returns (answer, sources).
  Future<({String answer, List<Source> sources})> ask(
      String question, String language) async {
    final body =
        await _post('/ask', {'question': question, 'language': language});
    final sources = (body['sources'] as List? ?? [])
        .map((s) => Source.fromJson(s as Map<String, dynamic>))
        .toList();
    return (answer: body['answer'] as String? ?? '', sources: sources);
  }

  /// Upload one or more PDFs. Returns the backend's upload report.
  Future<Map<String, dynamic>> uploadPdfs(
      List<({String name, List<int> bytes})> files) async {
    final req = http.MultipartRequest('POST', _uri('/upload'));
    req.headers.addAll(_authHeaders);
    for (final f in files) {
      req.files.add(http.MultipartFile.fromBytes('files', f.bytes,
          filename: f.name));
    }
    try {
      final streamed = await _http.send(req).timeout(
            const Duration(seconds: 300),
          );
      final res = await http.Response.fromStream(streamed);
      return _decode(res);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Upload failed. $e');
    }
  }

  Future<Map<String, dynamic>> nextToken() => _post('/tokens/next', {});

  Future<AdminStats> adminStats() async =>
      AdminStats.fromJson(await _get('/admin/stats'));

  Future<List<Map<String, dynamic>>> adminQueries() async {
    final body = await _get('/admin/queries');
    return (body['queries'] as List? ?? [])
        .map((q) => Map<String, dynamic>.from(q as Map))
        .toList();
  }

  // ---------- Gemini API key (admin only) ----------
  // The key itself is never returned by the backend — only a masked status
  // (configured / source manual|env|none / last 4 chars).

  /// Masked status: {configured, source, masked}.
  Future<Map<String, dynamic>> apiKeyStatus() =>
      _get('/admin/api-key/status');

  /// Save a new key entered by an admin. Takes effect immediately.
  Future<Map<String, dynamic>> setApiKey(String key) =>
      _post('/admin/api-key', {'api_key': key});

  /// One tiny live call with the active key to prove it works.
  Future<Map<String, dynamic>> testApiKey() =>
      _post('/admin/api-key/test', {});

  /// Remove the manually-entered key (falls back to the env key).
  Future<void> clearApiKey() async {
    await _delete('/admin/api-key');
  }
}
