import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

/// Test-question set: runs the fixed questions LIVE against /ask and shows
/// pass/fail against the expected answer. Nothing is hardcoded — results
/// are computed at runtime.
class TestQuestionsScreen extends StatefulWidget {
  final ApiClient client;

  const TestQuestionsScreen({super.key, required this.client});

  @override
  State<TestQuestionsScreen> createState() => _TestQuestionsScreenState();
}

class _TestQuestionsScreenState extends State<TestQuestionsScreen> {
  List<TestQuestion>? _questions;
  Map<int, ({bool pass, String answer})> _results = {};
  bool _loading = true;
  bool _running = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final questions = await widget.client.testQuestions();
      if (mounted) setState(() => _questions = questions);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load questions. $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _runAll() async {
    final questions = _questions;
    if (questions == null || _running) return;
    setState(() {
      _running = true;
      _results = {};
    });
    for (final q in questions) {
      try {
        final result = await widget.client.ask(q.question, 'en');
        if (!mounted) return;
        setState(() {
          _results[q.id] = (
            pass: result.answer
                .toLowerCase()
                .contains(q.expected.toLowerCase()),
            answer: result.answer,
          );
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _results[q.id] = (pass: false, answer: 'Request failed.');
        });
      }
    }
    if (mounted) setState(() => _running = false);
  }

  @override
  Widget build(BuildContext context) {
    final passed = _results.values.where((r) => r.pass).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Test questions')),
      body: GradientBackground(
        child: Column(
          children: [
            const DisclaimerBanner(),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(child: Text(_error!))
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            RoundCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _results.isEmpty
                                        ? 'Run the fixed question set against the live bot.'
                                        : '$passed / ${_results.length} passed',
                                    style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Each question is asked to the real backend; '
                                    'pass means the answer contains the expected text.',
                                    style: TextStyle(color: AppTheme.muted),
                                  ),
                                  const SizedBox(height: 12),
                                  ElevatedButton(
                                    onPressed: _running ? null : _runAll,
                                    child: _running
                                        ? const Text('Running…')
                                        : const Text('Run all questions'),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            ...(_questions ?? []).map((q) {
                              final r = _results[q.id];
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: RoundCard(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              q.question,
                                              style: const TextStyle(
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w600),
                                            ),
                                          ),
                                          if (r != null)
                                            Icon(
                                              r.pass
                                                  ? Icons.check_circle
                                                  : Icons.cancel,
                                              color: r.pass
                                                  ? AppTheme.emerald
                                                  : Colors.red,
                                            ),
                                        ],
                                      ),
                                      Text(
                                        'Expected: ${q.expected}',
                                        style: const TextStyle(
                                            color: AppTheme.muted,
                                            fontSize: 13),
                                      ),
                                      if (r != null) ...[
                                        const SizedBox(height: 6),
                                        Text(r.answer,
                                            style:
                                                const TextStyle(fontSize: 14)),
                                      ],
                                    ],
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
