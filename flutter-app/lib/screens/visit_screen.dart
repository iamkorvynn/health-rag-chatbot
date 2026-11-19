import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

/// Visit tab: clinic timings / fees / emergency policy (from the real guide
/// PDF) + the live token queue — take a token, see the current token.
class VisitScreen extends StatefulWidget {
  final ApiClient client;

  const VisitScreen({super.key, required this.client});

  @override
  State<VisitScreen> createState() => _VisitScreenState();
}

class _VisitScreenState extends State<VisitScreen> {
  VisitInfo? _info;
  TokenQueue? _queue;
  String? _error;
  bool _loading = true;
  final _nameController = TextEditingController();
  bool _taking = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final info = await widget.client.visitInfo();
      final queue = await widget.client.tokens();
      if (mounted) {
        setState(() {
          _info = VisitInfo.fromJson(info);
          _queue = queue;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load visit info. $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _takeToken() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your name to take a token.')),
      );
      return;
    }
    setState(() => _taking = true);
    try {
      final res = await widget.client.takeToken(name);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Your token is ${res['number']} (position ${res['position']} in queue).'),
        ),
      );
      _nameController.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _taking = false);
    }
  }

  Future<void> _callNext() async {
    try {
      final res = await widget.client.nextToken();
      if (!mounted) return;
      final called = res['called'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(called == null
              ? 'No one is waiting in the queue.'
              : 'Now calling token ${called['number']} — ${called['name']}.'),
        ),
      );
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    final queue = _queue!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Current token — big circle like the reference image.
          RoundCard(
            child: Column(
              children: [
                const Text(
                  'Now serving',
                  style: TextStyle(color: AppTheme.muted, fontSize: 14),
                ),
                const SizedBox(height: 8),
                Container(
                  width: 120,
                  height: 120,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppTheme.lime,
                  ),
                  child: Center(
                    child: Text(
                      queue.current == null
                          ? '—'
                          : '${queue.current!.number}',
                      style: const TextStyle(
                        color: AppTheme.onLime,
                        fontSize: 44,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  queue.current == null
                      ? 'No token is being served right now.'
                      : queue.current!.name,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600),
                ),
                Text(
                  '${queue.waiting.length} waiting · ${queue.servedCount} served',
                  style: const TextStyle(color: AppTheme.muted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          RoundCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Take a token',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                TextField(
                  key: const Key('tokenNameField'),
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Your name',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _takeToken(),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  key: const Key('takeTokenButton'),
                  onPressed: _taking ? null : _takeToken,
                  child: _taking
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppTheme.onLime),
                        )
                      : const Text('Take token'),
                ),
                if (widget.client.canCallNext) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _callNext,
                    child: const Text('Call next token (staff)'),
                  ),
                ],
              ],
            ),
          ),
          if (queue.waiting.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text(
              'Waiting',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ...queue.waiting.map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: RoundCard(
                    padding: const EdgeInsets.symmetric(
                        vertical: 12, horizontal: 16),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: AppTheme.glass,
                          child: Text('${t.number}',
                              style: const TextStyle(
                                  color: AppTheme.limeDeep,
                                  fontWeight: FontWeight.w700)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(t.name,
                              style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                )),
          ],
          const SizedBox(height: 16),
          if (_info != null) ...[
            _infoCard('Clinic timings', Icons.schedule, _info!.timings),
            _infoCard('Consultation fees', Icons.payments, _info!.fees),
            _infoCard(
                'Emergency policy', Icons.emergency, _info!.emergency),
            Text(
              'Source: ${_info!.sourceFile}',
              style: const TextStyle(fontSize: 12, color: AppTheme.muted),
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoCard(String title, IconData icon, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: RoundCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AppTheme.emerald, size: 20),
                const SizedBox(width: 8),
                Text(title,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            Text(body, style: const TextStyle(fontSize: 14)),
          ],
        ),
      ),
    );
  }
}
