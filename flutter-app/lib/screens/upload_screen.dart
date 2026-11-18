import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';

/// Upload PDFs (including scanned ones — the backend OCRs them and
/// re-indexes). Shows which files were OCR-read.
class UploadScreen extends StatefulWidget {
  final ApiClient client;

  const UploadScreen({super.key, required this.client});

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  bool _busy = false;
  String? _result;
  String? _error;
  List<String> _picked = [];

  Future<void> _pickAndUpload() async {
    // file_picker 13: static pickFiles() returns a List<PlatformFile>;
    // bytes are read with readAsBytes().
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
    );
    if (picked.isEmpty) return;
    final files = <({String name, List<int> bytes})>[];
    for (final f in picked) {
      files.add((name: f.name, bytes: await f.readAsBytes()));
    }
    if (files.isEmpty) {
      setState(() => _error = 'Could not read the selected files.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _picked = files.map((f) => f.name).toList();
    });
    try {
      final res = await widget.client.uploadPdfs(files);
      if (!mounted) return;
      final uploaded = (res['uploaded'] as List? ?? []).join(', ');
      final ocr = (res['ocr'] as List? ?? [])
          .where((o) => o['ocr_applied'] == true)
          .map((o) => o['file'])
          .toList();
      setState(() {
        _result = 'Uploaded: $uploaded\n'
            'Files indexed: ${res['files_indexed']} · '
            'Embedded: ${res['embedded'] == true ? 'yes' : 'not yet'}\n'
            '${ocr.isEmpty ? 'No scanned pages needed OCR.' : 'OCR applied to: ${ocr.join(', ')}'}';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Upload failed. $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Upload PDFs')),
      body: GradientBackground(
        child: Column(
          children: [
            const DisclaimerBanner(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    RoundCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Add clinic PDFs',
                            style: TextStyle(
                                fontSize: 17, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Patient files, protocols, or guides. PDFs with '
                            'almost no text (scanned pages) are OCR-read '
                            'automatically and then searchable.',
                            style: TextStyle(color: AppTheme.muted),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            key: const Key('pickPdfButton'),
                            onPressed: _busy ? null : _pickAndUpload,
                            icon: const Icon(Icons.attach_file),
                            label: _busy
                                ? const Text('Uploading…')
                                : const Text('Choose PDFs'),
                          ),
                          if (_picked.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            ..._picked.map((n) => Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 2),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.picture_as_pdf,
                                          size: 18, color: AppTheme.lime),
                                      const SizedBox(width: 8),
                                      Expanded(child: Text(n)),
                                    ],
                                  ),
                                )),
                          ],
                        ],
                      ),
                    ),
                    if (_busy) ...[
                      const SizedBox(height: 16),
                      const Center(child: CircularProgressIndicator()),
                      const SizedBox(height: 8),
                      const Text(
                        'Uploading and re-indexing — this can take a minute.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppTheme.muted),
                      ),
                    ],
                    if (_result != null) ...[
                      const SizedBox(height: 16),
                      RoundCard(
                        child: Text(_result!,
                            style: const TextStyle(fontSize: 14)),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      Text(_error!,
                          style: const TextStyle(color: Colors.red)),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
