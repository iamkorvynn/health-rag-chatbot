import 'package:flutter/material.dart';

import '../api.dart';
import '../config.dart';
import '../theme.dart';

/// Settings: API base URL (the tunnel rotates — change it here), answer
/// language, server health check, sign out.
class SettingsScreen extends StatefulWidget {
  final ApiClient client;
  final String language;
  final ValueChanged<String> onLanguageChanged;
  final VoidCallback onLoggedOut;
  final ValueChanged<String> onBaseUrlChanged;

  const SettingsScreen({
    super.key,
    required this.client,
    required this.language,
    required this.onLanguageChanged,
    required this.onLoggedOut,
    required this.onBaseUrlChanged,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _urlController;
  String? _healthResult;
  bool _checking = false;

  // Gemini API key (admin only).
  final _keyController = TextEditingController();
  Map<String, dynamic>? _keyStatus;
  bool _keyBusy = false;
  String? _keyMessage;
  bool _keyObscure = true;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.client.baseUrl);
    if (widget.client.isAdmin) _loadKeyStatus();
  }

  @override
  void dispose() {
    _urlController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _loadKeyStatus() async {
    try {
      final status = await widget.client.apiKeyStatus();
      if (mounted) setState(() => _keyStatus = status);
    } catch (_) {
      // Status is best-effort; Save/Test will surface real errors.
    }
  }

  Future<void> _saveKey() async {
    final key = _keyController.text.trim();
    if (key.isEmpty) {
      setState(() => _keyMessage = 'Paste a Gemini API key first.');
      return;
    }
    setState(() {
      _keyBusy = true;
      _keyMessage = null;
    });
    try {
      final res = await widget.client.setApiKey(key);
      if (!mounted) return;
      setState(() {
        _keyStatus = res;
        _keyMessage = 'Key saved — it takes effect immediately.';
        _keyController.clear();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _keyMessage = e.message);
    } finally {
      if (mounted) setState(() => _keyBusy = false);
    }
  }

  Future<void> _testKey() async {
    setState(() {
      _keyBusy = true;
      _keyMessage = null;
    });
    try {
      final res = await widget.client.testApiKey();
      if (!mounted) return;
      setState(() => _keyMessage = res['detail'] as String? ?? 'Done.');
    } on ApiException catch (e) {
      if (mounted) setState(() => _keyMessage = e.message);
    } finally {
      if (mounted) setState(() => _keyBusy = false);
    }
  }

  Future<void> _removeKey() async {
    setState(() {
      _keyBusy = true;
      _keyMessage = null;
    });
    try {
      await widget.client.clearApiKey();
      if (!mounted) return;
      setState(() => _keyMessage = 'Manual key removed — using the server key.');
      await _loadKeyStatus();
    } on ApiException catch (e) {
      if (mounted) setState(() => _keyMessage = e.message);
    } finally {
      if (mounted) setState(() => _keyBusy = false);
    }
  }

  String get _keyStatusText {
    final s = _keyStatus;
    if (s == null) return 'Key status unknown.';
    if (s['configured'] != true) return 'No Gemini API key configured.';
    final masked = s['masked'] as String?;
    return 'Key active · source: ${s['source']} · ••••${masked ?? '????'}';
  }

  Future<void> _saveUrl() async {
    var url = _urlController.text.trim();
    if (url.isEmpty) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://$url';
    }
    url = url.replaceAll(RegExp(r'/$'), '');
    if (url == widget.client.baseUrl) {
      setState(() => _healthResult = 'Already using this address.');
      return;
    }
    // Changing server signs the user out (tokens belong to one server).
    widget.onBaseUrlChanged(url);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Server address saved. Please sign in again.'),
        ),
      );
      Navigator.of(context).pop();
    }
  }

  Future<void> _checkHealth() async {
    setState(() {
      _checking = true;
      _healthResult = null;
    });
    try {
      final h = await widget.client.health();
      if (!mounted) return;
      setState(() {
        _healthResult = 'Server OK · ${h['files_indexed'] ?? '?'} files · '
            '${h['patients_indexed'] ?? '?'} patients · '
            'API key: ${h['api_key_set'] == true ? 'set' : 'NOT set'}';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _healthResult = 'Server error: ${e.message}');
    } catch (e) {
      if (mounted) {
        setState(() => _healthResult = 'Could not reach the server. $e');
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: GradientBackground(
        child: Column(
          children: [
            const DisclaimerBanner(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  RoundCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'API server address',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'The backend runs behind a free tunnel whose '
                          'address changes when it reconnects. If the app '
                          'stops answering, paste the new address here.',
                          style:
                              TextStyle(color: AppTheme.muted, fontSize: 13),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          key: const Key('baseUrlField'),
                          controller: _urlController,
                          decoration: const InputDecoration(
                            labelText: 'Base URL',
                            prefixIcon: Icon(Icons.link),
                          ),
                          keyboardType: TextInputType.url,
                          autocorrect: false,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                key: const Key('saveBaseUrlButton'),
                                onPressed: _saveUrl,
                                child: const Text('Save address'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton(
                              onPressed: _checking ? null : _checkHealth,
                              child: _checking
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Text('Test'),
                            ),
                          ],
                        ),
                        if (_healthResult != null) ...[
                          const SizedBox(height: 10),
                          Text(_healthResult!,
                              style: const TextStyle(fontSize: 13)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  RoundCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Answer language',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 8),
                        ...AppConfig.languages.entries.map(
                          (e) => RadioListTile<String>(
                            title: Text(e.value),
                            value: e.key,
                            groupValue: widget.language,
                            onChanged: (v) {
                              if (v != null) widget.onLanguageChanged(v);
                            },
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (widget.client.isAdmin)
                    RoundCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Gemini API key',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _keyStatusText,
                            style: const TextStyle(
                                color: AppTheme.muted, fontSize: 13),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'When the free-tier quota runs out, paste a new '
                            'key here instead of waiting on anyone. The full '
                            'key is never shown or stored on this phone.',
                            style: TextStyle(
                                color: AppTheme.muted, fontSize: 13),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            key: const Key('apiKeyField'),
                            controller: _keyController,
                            decoration: InputDecoration(
                              labelText: 'New Gemini API key',
                              prefixIcon:
                                  const Icon(Icons.key_outlined),
                              suffixIcon: IconButton(
                                icon: Icon(_keyObscure
                                    ? Icons.visibility_off
                                    : Icons.visibility),
                                onPressed: () => setState(
                                    () => _keyObscure = !_keyObscure),
                              ),
                            ),
                            obscureText: _keyObscure,
                            autocorrect: false,
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  key: const Key('saveApiKeyButton'),
                                  onPressed: _keyBusy ? null : _saveKey,
                                  child: const Text('Save key'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              OutlinedButton(
                                key: const Key('testApiKeyButton'),
                                onPressed: _keyBusy ? null : _testKey,
                                child: const Text('Test'),
                              ),
                            ],
                          ),
                          if (_keyStatus?['source'] == 'manual') ...[
                            const SizedBox(height: 8),
                            TextButton(
                              onPressed: _keyBusy ? null : _removeKey,
                              child: const Text(
                                'Remove manual key (use server key)',
                                style: TextStyle(color: Colors.redAccent),
                              ),
                            ),
                          ],
                          if (_keyMessage != null) ...[
                            const SizedBox(height: 10),
                            Text(_keyMessage!,
                                style: const TextStyle(fontSize: 13)),
                          ],
                        ],
                      ),
                    ),
                  const SizedBox(height: 12),
                  RoundCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Signed in as ${widget.client.username ?? ''} '
                          '(${widget.client.role ?? ''})',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          'App version ${AppConfig.appVersion} · '
                          '${AppConfig.clinicName}',
                          style: const TextStyle(color: AppTheme.muted),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: () {
                              widget.onLoggedOut();
                              Navigator.of(context).pop();
                            },
                            icon: const Icon(Icons.logout),
                            label: const Text('Sign out'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
