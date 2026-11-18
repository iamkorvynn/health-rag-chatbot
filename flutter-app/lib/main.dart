import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'config.dart';
import 'screens/chat_screen.dart';
import 'screens/login_screen.dart';
import 'screens/more_screen.dart';
import 'screens/patients_screen.dart';
import 'screens/visit_screen.dart';
import 'theme.dart';

/// Health RAG Chatbot — Sunrise Family Clinic (native Android app).
///
/// Session: JWT + API base URL + language are stored in SharedPreferences.
/// The app opens on the login screen unless a saved token still validates.
void main() {
  runApp(const HealthRagApp());
}

class HealthRagApp extends StatefulWidget {
  const HealthRagApp({super.key});

  @override
  State<HealthRagApp> createState() => _HealthRagAppState();
}

class _HealthRagAppState extends State<HealthRagApp> {
  ApiClient? _client;
  String _language = 'en';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final baseUrl = prefs.getString('base_url') ?? AppConfig.defaultBaseUrl;
    final language = prefs.getString('language') ?? 'en';
    final client = ApiClient(baseUrl: baseUrl)
      ..token = prefs.getString('jwt_token');
    var loggedIn = false;
    if (client.token != null) {
      try {
        await client.validateSession();
        loggedIn = true;
      } catch (_) {
        client.logout();
      }
    }
    if (!mounted) return;
    setState(() {
      _client = client;
      _language = language;
      _loading = false;
      if (!loggedIn) _client = client; // stay logged out, client still usable
    });
  }

  Future<void> _onLoggedIn(ApiClient client) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', client.token ?? '');
    await prefs.setString('username', client.username ?? '');
    await prefs.setString('role', client.role ?? '');
    await prefs.setString('base_url', client.baseUrl);
    setState(() {});
  }

  Future<void> _onLoggedOut() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('username');
    await prefs.remove('role');
    _client?.logout();
    setState(() {});
  }

  Future<void> _onBaseUrlChanged(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('base_url', url);
    _client?.baseUrl = url;
    // A new server means a new login.
    await _onLoggedOut();
  }

  Future<void> _onLanguageChanged(String language) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('language', language);
    setState(() => _language = language);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${AppConfig.appName} — ${AppConfig.clinicName}',
      theme: AppTheme.dark,
      debugShowCheckedModeBanner: false,
      home: _loading || _client == null
          ? const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            )
          : _client!.token == null
              ? LoginScreen(
                  client: _client!,
                  onLoggedIn: () => _onLoggedIn(_client!),
                  onBaseUrlChanged: _onBaseUrlChanged,
                )
              : HomeShell(
                  client: _client!,
                  language: _language,
                  onLanguageChanged: _onLanguageChanged,
                  onLoggedOut: _onLoggedOut,
                  onBaseUrlChanged: _onBaseUrlChanged,
                ),
    );
  }
}

/// Bottom-nav shell: Chat, Patients, Visit, More.
class HomeShell extends StatefulWidget {
  final ApiClient client;
  final String language;
  final ValueChanged<String> onLanguageChanged;
  final VoidCallback onLoggedOut;
  final ValueChanged<String> onBaseUrlChanged;

  const HomeShell({
    super.key,
    required this.client,
    required this.language,
    required this.onLanguageChanged,
    required this.onLoggedOut,
    required this.onBaseUrlChanged,
  });

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      ChatScreen(
          client: widget.client,
          language: widget.language,
          onLanguageChanged: widget.onLanguageChanged),
      PatientsScreen(client: widget.client),
      VisitScreen(client: widget.client),
      MoreScreen(
        client: widget.client,
        language: widget.language,
        onLanguageChanged: widget.onLanguageChanged,
        onLoggedOut: widget.onLoggedOut,
        onBaseUrlChanged: widget.onBaseUrlChanged,
      ),
    ];
    const titles = ['Chat', 'Patients', 'Visit', 'More'];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_index]),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Chip(
              label: Text(
                '${widget.client.username ?? ''} · ${widget.client.role ?? ''}',
                style: const TextStyle(fontSize: 12),
              ),
              backgroundColor: AppTheme.glass,
              side: BorderSide.none,
            ),
          ),
        ],
      ),
      body: GradientBackground(
        child: Column(
          children: [
            const DisclaimerBanner(),
            Expanded(child: pages[_index]),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppTheme.surface,
          boxShadow: [
            BoxShadow(
              color: AppTheme.lime.withOpacity(0.12),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppTheme.surface,
          selectedItemColor: AppTheme.lime,
          unselectedItemColor: AppTheme.muted,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
            BottomNavigationBarItem(icon: Icon(Icons.people_outline), label: 'Patients'),
            BottomNavigationBarItem(icon: Icon(Icons.confirmation_number_outlined), label: 'Visit'),
            BottomNavigationBarItem(icon: Icon(Icons.grid_view_rounded), label: 'More'),
          ],
        ),
      ),
    );
  }
}
