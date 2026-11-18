import 'package:flutter/material.dart';

import '../api.dart';
import '../config.dart';
import '../theme.dart';

/// Login screen. JWT auth against POST /auth/login.
/// Demo accounts are the project's documented seed accounts
/// (admin / doctor / staff) — tap a chip to fill them in.
/// The server address is found automatically on startup (see
/// url_resolver.dart) and shown here; it stays editable as a fallback,
/// but the user should never need to change it.
class LoginScreen extends StatefulWidget {
  final ApiClient client;
  final VoidCallback onLoggedIn;
  final ValueChanged<String> onBaseUrlChanged;

  const LoginScreen({
    super.key,
    required this.client,
    required this.onLoggedIn,
    required this.onBaseUrlChanged,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userController = TextEditingController();
  final _passController = TextEditingController();
  late final TextEditingController _urlController;
  bool _busy = false;
  String? _error;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.client.baseUrl);
  }

  @override
  void dispose() {
    _userController.dispose();
    _passController.dispose();
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final username = _userController.text.trim();
    final password = _passController.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your username and password.');
      return;
    }
    // The tunnel URL rotates — apply an edited address before signing in.
    var url = _urlController.text.trim();
    if (url.isNotEmpty && url != widget.client.baseUrl) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://$url';
      }
      widget.onBaseUrlChanged(url.replaceAll(RegExp(r'/$'), ''));
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.client.login(username, password);
      widget.onLoggedIn();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Could not reach the server. $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _fillDemo(String user, String pass) {
    _userController.text = user;
    _passController.text = pass;
    setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Column(
            children: [
              const DisclaimerBanner(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 24),
                      Container(
                        width: 88,
                        height: 88,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.emeraldDeep,
                          border: Border.all(
                              color: AppTheme.lime.withOpacity(0.5),
                              width: 1.5),
                        ),
                        child: const Icon(Icons.local_hospital_rounded,
                            size: 44, color: AppTheme.lime),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Welcome back',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.ink,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        AppConfig.clinicName,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          color: AppTheme.muted,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Ask questions about the clinic records.\nAnswers come only from the documents.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 14, color: AppTheme.muted),
                      ),
                      const SizedBox(height: 32),
                      RoundCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextField(
                              key: const Key('usernameField'),
                              controller: _userController,
                              decoration: const InputDecoration(
                                labelText: 'Username',
                                prefixIcon: Icon(Icons.person_outline),
                              ),
                              textInputAction: TextInputAction.next,
                              autocorrect: false,
                            ),
                            const SizedBox(height: 14),
                            TextField(
                              key: const Key('passwordField'),
                              controller: _passController,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscure
                                      ? Icons.visibility_off
                                      : Icons.visibility),
                                  onPressed: () =>
                                      setState(() => _obscure = !_obscure),
                                ),
                              ),
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) => _login(),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              Text(
                                _error!,
                                key: const Key('loginError'),
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                            const SizedBox(height: 18),
                            ElevatedButton(
                              key: const Key('loginButton'),
                              onPressed: _busy ? null : _login,
                              child: _busy
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppTheme.onLime,
                                      ),
                                    )
                                  : const Text('Sign in'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Demo accounts',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppTheme.muted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 8,
                        children: [
                          _demoChip('Admin', 'admin', 'admin123'),
                          _demoChip('Doctor', 'doctor', 'doctor123'),
                          _demoChip('Staff', 'staff', 'staff123'),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Server: ${widget.client.baseUrl}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.muted,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        key: const Key('serverUrlField'),
                        controller: _urlController,
                        decoration: const InputDecoration(
                          labelText: 'Server address',
                          prefixIcon: Icon(Icons.link),
                          helperText:
                              'Found automatically — you don’t need to change this.',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _demoChip(String label, String user, String pass) {
    return ActionChip(
      label: Text(label),
      onPressed: () => _fillDemo(user, pass),
      backgroundColor: AppTheme.glass,
      side: BorderSide(color: AppTheme.lime.withOpacity(0.3)),
    );
  }
}
