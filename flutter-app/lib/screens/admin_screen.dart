import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';

/// Admin dashboard (admin role only): documents indexed, questions asked,
/// fallback rate, and the recent query log — all read live from the backend.
class AdminScreen extends StatefulWidget {
  final ApiClient client;

  const AdminScreen({super.key, required this.client});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>>? _queries;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final stats = await widget.client.adminStats();
      final queries = await widget.client.adminQueries();
      if (mounted) {
        setState(() {
          _stats = {
            'documents_indexed': stats.documentsIndexed,
            'questions_asked': stats.questionsAsked,
            'fallback_rate': stats.fallbackRate,
          };
          _queries = queries;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load dashboard. $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin dashboard')),
      body: GradientBackground(
        child: Column(
          children: [
            const DisclaimerBanner(),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_error!, textAlign: TextAlign.center),
                                const SizedBox(height: 12),
                                ElevatedButton(
                                    onPressed: _load,
                                    child: const Text('Retry')),
                              ],
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView(
                            padding: const EdgeInsets.all(16),
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: _statCard(
                                      'Documents',
                                      '${_stats!['documents_indexed']}',
                                      Icons.description_outlined,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: _statCard(
                                      'Questions',
                                      '${_stats!['questions_asked']}',
                                      Icons.question_answer_outlined,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _statCard(
                                'Fallback rate',
                                '${((_stats!['fallback_rate'] as double) * 100).toStringAsFixed(1)}%',
                                Icons.warning_amber_outlined,
                                wide: true,
                              ),
                              const SizedBox(height: 20),
                              const Text(
                                'Recent queries',
                                style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 8),
                              ...(_queries ?? []).map((q) {
                                final fallback = q['fallback'] == true;
                                return Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 10),
                                  child: RoundCard(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                q['question'] as String? ?? '',
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.w600),
                                              ),
                                            ),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      vertical: 3,
                                                      horizontal: 8),
                                              decoration: BoxDecoration(
                                                color: fallback
                                                    ? Colors.red
                                                        .withOpacity(0.12)
                                                    : AppTheme.emerald
                                                        .withOpacity(0.12),
                                                borderRadius:
                                                    BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                fallback
                                                    ? 'fallback'
                                                    : 'answered',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                  color: fallback
                                                      ? Colors.red
                                                      : AppTheme.emerald,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          (q['answer'] as String? ?? ''),
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              color: AppTheme.muted,
                                              fontSize: 13),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${q['username'] ?? ''} · ${q['timestamp'] ?? ''}',
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: AppTheme.muted),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon,
      {bool wide = false}) {
    return RoundCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.glass,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppTheme.lime),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              Text(label, style: const TextStyle(color: AppTheme.muted)),
            ],
          ),
        ],
      ),
    );
  }
}
