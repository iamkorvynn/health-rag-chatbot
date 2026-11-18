import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import 'admin_screen.dart';
import 'how_it_works_screen.dart';
import 'settings_screen.dart';
import 'test_questions_screen.dart';
import 'upload_screen.dart';

/// "More" tab: Upload PDFs, Test Questions, Admin Dashboard (admin only),
/// How It Works, Settings. Each opens as its own screen.
class MoreScreen extends StatelessWidget {
  final ApiClient client;
  final String language;
  final ValueChanged<String> onLanguageChanged;
  final VoidCallback onLoggedOut;
  final ValueChanged<String> onBaseUrlChanged;

  const MoreScreen({
    super.key,
    required this.client,
    required this.language,
    required this.onLanguageChanged,
    required this.onLoggedOut,
    required this.onBaseUrlChanged,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _menuCard(
          context,
          icon: Icons.upload_file_outlined,
          title: 'Upload PDFs',
          subtitle: 'Add clinic PDFs — scanned ones are OCR-read.',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
                builder: (_) => UploadScreen(client: client)),
          ),
        ),
        _menuCard(
          context,
          icon: Icons.fact_check_outlined,
          title: 'Test questions',
          subtitle: 'Run the fixed question set live against the bot.',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
                builder: (_) => TestQuestionsScreen(client: client)),
          ),
        ),
        if (client.isAdmin)
          _menuCard(
            context,
            icon: Icons.dashboard_outlined,
            title: 'Admin dashboard',
            subtitle: 'Documents, questions, fallback rate, query log.',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => AdminScreen(client: client)),
            ),
          ),
        _menuCard(
          context,
          icon: Icons.account_tree_outlined,
          title: 'How it works',
          subtitle: 'PDFs → chunks → embeddings → Gemini.',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const HowItWorksScreen()),
          ),
        ),
        _menuCard(
          context,
          icon: Icons.settings_outlined,
          title: 'Settings',
          subtitle: 'API server address, language, sign out.',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => SettingsScreen(
                client: client,
                language: language,
                onLanguageChanged: onLanguageChanged,
                onLoggedOut: onLoggedOut,
                onBaseUrlChanged: onBaseUrlChanged,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _menuCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: RoundCard(
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppTheme.glass,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: AppTheme.lime),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)),
                  Text(subtitle,
                      style:
                          const TextStyle(color: AppTheme.muted, fontSize: 13)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppTheme.muted),
          ],
        ),
      ),
    );
  }
}
