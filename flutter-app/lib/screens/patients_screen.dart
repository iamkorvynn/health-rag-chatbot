import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

/// Patients tab: list from GET /patients, tap for details.
class PatientsScreen extends StatefulWidget {
  final ApiClient client;

  const PatientsScreen({super.key, required this.client});

  @override
  State<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends State<PatientsScreen> {
  List<Patient>? _patients;
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
      final patients = await widget.client.patients();
      if (mounted) setState(() => _patients = patients);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load patients. $e');
    } finally {
      if (mounted) setState(() => _loading = false);
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
    final patients = _patients ?? [];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: patients.length + 1,
        itemBuilder: (context, i) {
          if (i == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                '${patients.length} patients in the clinic records',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.muted,
                ),
              ),
            );
          }
          final p = patients[i - 1];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: RoundCard(
              onTap: () => _showDetail(p),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.emeraldDeep,
                      border: Border.all(
                          color: AppTheme.lime.withOpacity(0.4)),
                    ),
                    child: Center(
                      child: Text(
                        p.name.isNotEmpty ? p.name[0] : '?',
                        style: const TextStyle(
                          color: AppTheme.lime,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          p.id,
                          style: const TextStyle(color: AppTheme.muted),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AppTheme.muted),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showDetail(Patient p) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              p.name,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            _detailRow('Patient ID', p.id),
            _detailRow('Record file', p.file),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  // Asking in chat is the fastest way to read the record.
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                          'Ask in Chat, e.g. "What is ${p.name} allergic to?"'),
                    ),
                  );
                },
                child: const Text('Ask about this patient'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: const TextStyle(color: AppTheme.muted)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
