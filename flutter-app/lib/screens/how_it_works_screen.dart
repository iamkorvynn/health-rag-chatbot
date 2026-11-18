import 'package:flutter/material.dart';

import '../theme.dart';

/// How the chatbot works — the real pipeline, same as the notebook.
class HowItWorksScreen extends StatelessWidget {
  const HowItWorksScreen({super.key});

  static const List<({String title, String body, IconData icon})> _steps = [
    (
      title: '1. Clinic PDFs',
      body: 'Patient records, the patient guide, and treatment protocols '
          'are loaded. Every page is tagged with its source file.',
      icon: Icons.picture_as_pdf,
    ),
    (
      title: '2. Split into chunks',
      body: 'Pages are split into 800-character chunks with 150 characters '
          'of overlap, so no answer is cut off mid-sentence.',
      icon: Icons.content_cut,
    ),
    (
      title: '3. Embeddings',
      body: 'Each chunk is turned into a vector with Google '
          'gemini-embedding-001 and stored in a ChromaDB collection '
          'called "clinic".',
      icon: Icons.hub_outlined,
    ),
    (
      title: '4. Retrieve (top 5)',
      body: 'Your question is embedded the same way and the 5 most similar '
          'chunks are retrieved — only chunks scoring 0.53 or higher are '
          'used, so unrelated files are never cited.',
      icon: Icons.search,
    ),
    (
      title: '5. Answer with Gemini 2.5 Flash',
      body: 'The model answers using ONLY the retrieved context, with the '
          'notebook system prompt. If the answer is not in the records, '
          'it says so instead of guessing.',
      icon: Icons.smart_toy_outlined,
    ),
    (
      title: '6. Sources, always',
      body: 'Every answer lists the file and page it came from, with the '
          'exact excerpt highlighted. Nothing is ever answered from '
          'outside knowledge.',
      icon: Icons.fact_check_outlined,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('How it works')),
      body: GradientBackground(
        child: Column(
          children: [
            const DisclaimerBanner(),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _steps.length + 1,
                itemBuilder: (context, i) {
                  if (i == 0) {
                    return const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text(
                        'The same pipeline as the college notebook — '
                        'PDFs in, answers out, with sources.',
                        style: TextStyle(
                          fontSize: 15,
                          color: AppTheme.muted,
                        ),
                      ),
                    );
                  }
                  final step = _steps[i - 1];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: RoundCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: AppTheme.glass,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(step.icon, color: AppTheme.lime),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  step.title,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(step.body,
                                    style: const TextStyle(fontSize: 14)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
